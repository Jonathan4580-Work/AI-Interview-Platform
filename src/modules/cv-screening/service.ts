import { createHash } from "node:crypto";
import { inflateRawSync, inflateSync } from "node:zlib";

import OpenAI from "openai";

import { env } from "@/config";
import { prisma } from "@/infra/database";
import { logger } from "@/infra/logging";
import { LocalFilesystemStorageProvider } from "@/modules/media/local-storage-provider";

export class CvScreeningError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "CvScreeningError";
  }
}

export async function extractCvTextForApplication(input: {
  readonly companyId: string;
  readonly applicationId: string;
}): Promise<{ readonly screeningId: string; readonly extractedTextLength: number }> {
  const screening = await loadScreening(input.companyId, input.applicationId);
  const document = await prisma.candidateDocument.findFirst({
    where: {
      companyId: input.companyId,
      candidateId: screening.candidateId,
      type: "RESUME",
      status: "ACTIVE",
      deletedAt: null,
      ...(screening.cvDocumentId === null ? {} : { id: screening.cvDocumentId }),
    },
    orderBy: { createdAt: "desc" },
  });

  if (document === null) {
    await markExtractionFailed(screening.id, "CV_DOCUMENT_MISSING", "CV document was not found.");
    throw new CvScreeningError("CV document was not found.", "CV_DOCUMENT_MISSING", false);
  }

  const bytes = await new LocalFilesystemStorageProvider().readObject(document.storageKey);
  const extraction = extractTextFromDocument(bytes, document.contentType, document.fileName);
  const normalizedText = extraction.text;

  await prisma.applicationCvScreening.update({
    where: {
      companyId_applicationId: { companyId: input.companyId, applicationId: input.applicationId },
    },
    data: {
      cvDocumentId: document.id,
      extractionStatus: "COMPLETE",
      extractedText: normalizedText,
      extractionQualityScore: extraction.quality.score,
      extractionMetadataRemoved: extraction.quality.metadataRemoved,
      extractionMethod: extraction.method,
      extractionRawLength: extraction.rawLength,
      extractionCleanedLength: extraction.cleanedLength,
      extractedTextHash:
        normalizedText.length === 0
          ? null
          : createHash("sha256").update(normalizedText, "utf8").digest("hex"),
      failureCode: null,
      failureMessageSafe: null,
    },
  });

  return { screeningId: screening.id, extractedTextLength: normalizedText.length };
}

export async function screenApplicationCv(input: {
  readonly companyId: string;
  readonly applicationId: string;
}): Promise<{
  readonly screeningId: string;
  readonly status: string;
  readonly matchScore: number | null;
}> {
  const screening = await loadScreening(input.companyId, input.applicationId);
  const application = await prisma.candidateApplication.findUnique({
    where: { companyId_id: { companyId: input.companyId, id: input.applicationId } },
    include: {
      job: { include: { intelligenceProfile: true } },
      candidate: true,
    },
  });
  if (application === null) {
    throw new CvScreeningError("Application was not found.", "APPLICATION_NOT_FOUND", false);
  }

  const cvText = normalizeExtractedText(screening.extractedText ?? "");
  const jobProfile = application.job.intelligenceProfile;
  const quality = scoreExtractedText(cvText);
  const qualityScore =
    screening.extractionQualityScore === null
      ? quality.score
      : Math.min(screening.extractionQualityScore, quality.score);
  if (cvText.length < 120 || qualityScore < 45 || jobProfile === null) {
    const result = createInsufficientEvidenceResult(
      qualityScore < 45
        ? "PDF text could not be extracted clearly. Ask candidate to upload DOCX or a selectable text PDF."
        : cvText.length < 120
          ? "CV text was too short to evaluate reliably."
          : "Published JD intelligence was not available.",
    );
    await persistScreeningResult(input.companyId, input.applicationId, result, {
      provider: "deterministic",
      model: "insufficient-evidence",
    });
    return { screeningId: screening.id, status: "COMPLETE", matchScore: result.matchScore };
  }

  if (env.OPENAI_API_KEY === undefined || env.OPENAI_API_KEY.length === 0) {
    throw new CvScreeningError("OpenAI API key is not configured.", "PROVIDER_UNAVAILABLE", true);
  }

  const providerInput = buildProviderInput({
    cvText,
    jobTitle: application.job.title,
    roleSummary: readSummary(application.job.descriptionJson),
    responsibilities: readStringArray(jobProfile.responsibilitiesJson),
    requiredSkills: readStringArray(jobProfile.requiredSkillsJson),
    niceToHaveSkills: readStringArray(jobProfile.niceToHaveSkillsJson),
    competencies: readCompetencies(jobProfile.competenciesJson),
  });

  logger.info(
    {
      applicationId: input.applicationId,
      model: env.OPENAI_MODEL,
      cvTextLength: cvText.length,
      inputLength: providerInput.length,
      schemaName: "aptly_cv_screening_v1",
      timeoutMs: env.EVALUATION_PROVIDER_TIMEOUT_MS,
    },
    "OpenAI CV screening request prepared.",
  );

  try {
    const response = await new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_API_URL,
      timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS,
    }).responses.create({
      model: env.OPENAI_MODEL,
      input: providerInput,
      text: {
        format: {
          type: "json_schema",
          name: "aptly_cv_screening_v1",
          strict: true,
          schema: cvScreeningJsonSchema,
        },
      },
    });

    const outputText = readResponseText(response);
    const parsed = parseCvScreeningProviderOutput(outputText);
    await persistScreeningResult(input.companyId, input.applicationId, parsed, {
      provider: "openai",
      model: env.OPENAI_MODEL,
    });
    return { screeningId: screening.id, status: "COMPLETE", matchScore: parsed.matchScore };
  } catch (error) {
    const normalized = normalizeOpenAIError(error);
    await prisma.applicationCvScreening.update({
      where: {
        companyId_applicationId: { companyId: input.companyId, applicationId: input.applicationId },
      },
      data: {
        screeningStatus: "FAILED",
        failureCode: normalized.code,
        failureMessageSafe: normalized.message,
      },
    });
    throw normalized;
  }
}

export async function ensureCvScreeningWorkflow(input: {
  readonly companyId: string;
  readonly applicationId: string;
  readonly candidateId: string;
  readonly jobId: string;
  readonly cvDocumentId: string;
  readonly workflowId?: string | null;
}): Promise<void> {
  await prisma.applicationCvScreening.upsert({
    where: {
      companyId_applicationId: { companyId: input.companyId, applicationId: input.applicationId },
    },
    create: {
      companyId: input.companyId,
      applicationId: input.applicationId,
      candidateId: input.candidateId,
      jobId: input.jobId,
      cvDocumentId: input.cvDocumentId,
      processingWorkflowId: input.workflowId ?? null,
      extractionStatus: "PENDING",
      screeningStatus: "PENDING",
      matchedSkillsJson: [],
      missingSkillsJson: [],
      concernsJson: [],
      focusAreasJson: [],
      evidenceJson: [],
      limitationsJson: [],
    },
    update: {
      cvDocumentId: input.cvDocumentId,
      processingWorkflowId: input.workflowId ?? undefined,
      extractionStatus: "PENDING",
      screeningStatus: "PENDING",
      extractionQualityScore: null,
      extractionMetadataRemoved: false,
      extractionMethod: null,
      extractionRawLength: null,
      extractionCleanedLength: null,
      failureCode: null,
      failureMessageSafe: null,
    },
  });
}

export function parseCvScreeningProviderOutput(output: string): CvScreeningResult {
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    throw new CvScreeningError(
      "OpenAI CV screening output was not valid JSON.",
      "MALFORMED_OUTPUT",
      false,
    );
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CvScreeningError(
      "OpenAI CV screening output was not an object.",
      "MALFORMED_OUTPUT",
      false,
    );
  }
  const record = value as Record<string, unknown>;
  const matchScore = readScore(record.matchScore);
  return {
    matchScore,
    recommendation: readEnum(record.recommendation, ["Recommended", "Maybe", "Not Recommended"]),
    confidence: readEnum(record.confidence, [
      "high",
      "moderate",
      "limited",
      "insufficient_evidence",
    ]),
    hrSummary: readRequiredString(record.hrSummary, "hrSummary"),
    matchedSkills: readStringList(record.matchedSkills),
    missingSkills: readStringList(record.missingSkills),
    experienceMatch: readRequiredString(record.experienceMatch, "experienceMatch"),
    responsibilityMatch: readRequiredString(record.responsibilityMatch, "responsibilityMatch"),
    educationMatch: readRequiredString(record.educationMatch, "educationMatch"),
    concerns: readStringList(record.concerns),
    suggestedInterviewFocusAreas: readStringList(record.suggestedInterviewFocusAreas),
    evidenceExcerpts: readStringList(record.cvEvidenceExcerpts),
    limitations: readStringList(record.limitations),
  };
}

export function extractTextFromDocument(
  bytes: Buffer,
  contentType: string,
  fileName: string,
): CvTextExtractionResult {
  const text = bytes.toString("latin1");
  let extractedText = "";
  let method = "unsupported";
  if (contentType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    const pdf = extractPdfText(bytes, text);
    extractedText = pdf.text;
    method = pdf.method;
  } else if (
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.toLowerCase().endsWith(".docx")
  ) {
    extractedText = extractDocxText(bytes, text);
    method = "docx_xml";
  }
  const cleaned = cleanExtractedResumeText(extractedText);
  const normalized = normalizeExtractedText(cleaned.text);
  const quality = scoreExtractedText(normalized, cleaned.metadataRemoved);
  return {
    text: normalized,
    quality,
    method,
    rawLength: extractedText.length,
    cleanedLength: normalized.length,
  };
}

function extractPdfText(
  bytes: Buffer,
  text: string,
): { readonly text: string; readonly method: string } {
  const streams = decodePdfStreams(bytes);
  const chunks = [text, ...streams.map((stream) => stream.text)];
  const cmap = buildPdfUnicodeMap(chunks.join("\n"));
  const textChunks = chunks.flatMap((chunk) => extractPdfTextTokens(chunk, cmap));
  const method =
    cmap.size > 0 && streams.length > 0
      ? "pdf_stream_cmap"
      : streams.length > 0
        ? "pdf_stream_text"
        : "pdf_literal_text";
  return { text: textChunks.join("\n"), method };
}

function decodePdfStreams(
  bytes: Buffer,
): readonly { readonly dictionary: string; readonly text: string }[] {
  const value = bytes.toString("latin1");
  const streams: { readonly dictionary: string; readonly text: string }[] = [];
  const streamPattern = /<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/gu;
  for (const match of value.matchAll(streamPattern)) {
    const dictionary = match[1];
    const stream = match[2];
    if (!dictionary.includes("FlateDecode")) continue;
    const streamBytes = Buffer.from(stream, "latin1");
    const inflated = inflatePdfStream(streamBytes);
    if (inflated.length > 0) streams.push({ dictionary, text: inflated });
  }
  return streams;
}

function inflatePdfStream(bytes: Buffer): string {
  try {
    return inflateSync(bytes).toString("utf8");
  } catch {
    try {
      return inflateRawSync(bytes).toString("utf8");
    } catch {
      return "";
    }
  }
}

function extractPdfTextTokens(text: string, cmap: ReadonlyMap<string, string>): readonly string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(/(\((?:\\.|[^\\()]){2,}\)|<([0-9A-Fa-f]{4,})>)\s*Tj/gu)) {
    tokens.push(decodePdfTextOperand(match[1], cmap));
  }
  for (const match of text.matchAll(/\[(.*?)\]\s*TJ/gsu)) {
    const arrayBody = match[1];
    const parts = [...arrayBody.matchAll(/\((?:\\.|[^\\()]){2,}\)|<([0-9A-Fa-f]{4,})>/gu)].map(
      (part) => decodePdfTextOperand(part[0], cmap),
    );
    tokens.push(parts.join(" "));
  }
  return tokens.map(normalizeExtractedText).filter(hasMinimumTextTokenLength);
}

function extractDocxLikeText(text: string): string {
  return text.replace(/<[^>]+>/gu, " ").replace(/[^\p{L}\p{N}\s.,;:!?@#/+()-]/gu, " ");
}

function extractDocxText(bytes: Buffer, fallbackText: string): string {
  const documentXml = readZipTextEntries(bytes)
    .filter((entry) =>
      /^word\/(?:document|footnotes|endnotes|header\d*|footer\d*)\.xml$/u.test(entry.name),
    )
    .map((entry) => entry.text)
    .join("\n");
  if (documentXml.length > 0) return extractDocxXmlText(documentXml);
  return extractDocxLikeText(fallbackText);
}

function readZipTextEntries(
  bytes: Buffer,
): readonly { readonly name: string; readonly text: string }[] {
  const entries: { readonly name: string; readonly text: string }[] = [];
  let offset = 0;
  while (offset < bytes.length - 30) {
    if (bytes.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const compressionMethod = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const fileNameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) break;
    const name = bytes.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const data = bytes.subarray(dataStart, dataEnd);
    const text = inflateZipEntry(data, compressionMethod);
    if (text.length > 0) entries.push({ name, text });
    offset = dataEnd;
  }
  return entries;
}

function inflateZipEntry(data: Buffer, compressionMethod: number): string {
  try {
    if (compressionMethod === 0) return data.toString("utf8");
    if (compressionMethod === 8) return inflateRawSync(data).toString("utf8");
    return "";
  } catch {
    return "";
  }
}

function extractDocxXmlText(xml: string): string {
  return xml
    .replace(/<w:tab\s*\/>/gu, " ")
    .replace(/<\/w:p>/gu, "\n")
    .replace(/<\/w:tr>/gu, "\n")
    .replace(/<\/w:tc>/gu, " ")
    .replace(/<[^>]+>/gu, "")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'");
}

function cleanExtractedResumeText(value: string): {
  readonly text: string;
  readonly metadataRemoved: boolean;
} {
  let metadataRemoved = false;
  const seen = new Set<string>();
  const lines = value
    .split(/[\r\n]+/u)
    .map((line) => normalizeExtractedText(line))
    .flatMap(splitLikelyResumeLine)
    .map((line) => normalizeExtractedText(line))
    .filter((line) => {
      if (line.length < 2) return false;
      if (isPdfMetadataLine(line) || isGarbledLine(line)) {
        metadataRemoved = true;
        return false;
      }
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { text: lines.join("\n"), metadataRemoved };
}

function splitLikelyResumeLine(line: string): readonly string[] {
  return line.split(/\s+[|•]\s+|\s{3,}/u);
}

function isPdfMetadataLine(line: string): boolean {
  const normalized = line.toLowerCase();
  return (
    /^d:\d{14}/u.test(normalized) ||
    /^(producer|creator|author|creationdate|moddate|trapped|metadata|pdf|xmp|adobe)\b/u.test(
      normalized,
    ) ||
    normalized === "anonymous" ||
    normalized === "opensource anonymous" ||
    /font|cidfont|encoding|obj|endobj|xref|startxref/u.test(normalized)
  );
}

function isGarbledLine(line: string): boolean {
  const letters = Array.from(line.matchAll(/\p{L}/gu)).length;
  const printable = Array.from(line).filter((char) =>
    /[\p{L}\p{N}\s.,;:!?@#/+()'-]/u.test(char),
  ).length;
  const ratio = line.length === 0 ? 0 : printable / line.length;
  return ratio < 0.72 || (line.length > 12 && letters < 4);
}

function buildPdfUnicodeMap(text: string): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const blockMatch of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/gu)) {
    const block = blockMatch[1];
    for (const pair of block.matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/gu)) {
      map.set(normalizePdfCode(pair[1]), decodePdfUnicodeHex(pair[2]));
    }
  }
  for (const blockMatch of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/gu)) {
    const block = blockMatch[1];
    for (const range of block.matchAll(
      /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/gu,
    )) {
      const start = Number.parseInt(range[1], 16);
      const end = Number.parseInt(range[2], 16);
      const target = Number.parseInt(range[3], 16);
      if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(target)) continue;
      for (let code = start; code <= end && code - start < 256; code += 1) {
        map.set(normalizePdfCode(code.toString(16)), String.fromCodePoint(target + code - start));
      }
    }
  }
  return map;
}

function decodePdfTextOperand(value: string, cmap: ReadonlyMap<string, string>): string {
  if (value.startsWith("(")) return decodePdfLiteral(value);
  const hex = value.replace(/[<>\s]/gu, "");
  if (cmap.size === 0) return decodePdfHex(hex);
  return splitPdfHexCodes(hex)
    .map((code) => cmap.get(normalizePdfCode(code)) ?? decodePdfHex(code))
    .join("");
}

function splitPdfHexCodes(hex: string): readonly string[] {
  if (hex.length % 4 === 0) return hex.match(/.{1,4}/gu) ?? [];
  return hex.match(/.{1,2}/gu) ?? [];
}

function normalizePdfCode(value: string): string {
  const normalized = value.toUpperCase();
  return normalized.length % 2 === 0 ? normalized : `0${normalized}`;
}

function decodePdfLiteral(value: string): string {
  return value
    .slice(1, -1)
    .replace(/\\([nrtbf()\\])/gu, (_match, escape: string) => {
      if (escape === "n" || escape === "r") return "\n";
      if (escape === "t") return " ";
      if (escape === "b" || escape === "f") return "";
      return escape;
    })
    .replace(/\\([0-7]{1,3})/gu, (_match, octal: string) =>
      String.fromCharCode(Number.parseInt(octal, 8)),
    );
}

function decodePdfHex(value: string): string {
  const pairs = value.length % 2 === 0 ? value : `${value}0`;
  const bytes = Buffer.from(pairs, "hex");
  const utf16 = bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
  return utf16 ? decodePdfUnicodeHex(pairs.slice(4)) : bytes.toString("utf8");
}

function decodePdfUnicodeHex(value: string): string {
  const pairs =
    value.length % 4 === 0 ? value : value.padStart(Math.ceil(value.length / 4) * 4, "0");
  const chars: string[] = [];
  for (let index = 0; index < pairs.length; index += 4) {
    const code = Number.parseInt(pairs.slice(index, index + 4), 16);
    if (Number.isFinite(code) && code > 0) chars.push(String.fromCodePoint(code));
  }
  return chars.join("");
}

function hasMinimumTextTokenLength(value: string): boolean {
  const normalized = normalizeExtractedText(value);
  return normalized.length >= 2;
}

function normalizeExtractedText(value: string): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, 40_000);
}

function readTextTokens(value: string): readonly string[] {
  return Array.from(value.matchAll(/\b[\p{L}][\p{L}+#.'-]{2,}\b/gu), (match) => match[0]);
}

function isGarbageToken(token: string): boolean {
  const normalized = token.replace(/['.-]/gu, "");
  if (normalized.length < 4) return false;
  const lower = normalized.toLowerCase();
  if (COMMON_RESUME_WORDS.has(lower)) return false;
  if (!/[aeiou]/iu.test(normalized)) return true;
  if (/[A-Z][a-z][A-Z]|[a-z][A-Z][a-z][A-Z]/u.test(normalized)) return true;
  const uppercaseCount = Array.from(normalized.matchAll(/[A-Z]/gu)).length;
  const uppercaseRatio = uppercaseCount / normalized.length;
  if (uppercaseRatio > 0.35 && uppercaseRatio < 0.9 && !KNOWN_MIXED_CASE_WORDS.has(lower))
    return true;
  const bigrams = new Set<string>();
  for (let index = 0; index < lower.length - 1; index += 1) {
    bigrams.add(lower.slice(index, index + 2));
  }
  return lower.length >= 9 && bigrams.size <= Math.ceil(lower.length / 3);
}

function countUsefulResumeKeywords(value: string): number {
  const lower = value.toLowerCase();
  return RESUME_KEYWORDS.reduce(
    (count, keyword) => (lower.includes(keyword) ? count + 1 : count),
    0,
  );
}

export function scoreExtractedText(
  value: string,
  metadataRemoved = false,
): CvTextExtractionQuality {
  const text = normalizeExtractedText(value);
  const tokens = readTextTokens(text);
  const usefulWords = tokens.filter((token) => token.length >= 3 && !isGarbageToken(token)).length;
  const garbageTokenCount = tokens.filter(isGarbageToken).length;
  const garbageTokenRatio = tokens.length === 0 ? 1 : garbageTokenCount / tokens.length;
  const usefulKeywordCount = countUsefulResumeKeywords(text);
  const sectionCount = RESUME_SECTION_PATTERNS.filter((pattern) => pattern.test(text)).length;
  const metadataLineCount = text
    .split(/[\r\n]+/u)
    .filter((line) => isPdfMetadataLine(line) || isGarbledLine(line)).length;
  const readabilityScore = Math.max(0, Math.round((1 - garbageTokenRatio) * 100));
  const lengthScore = Math.min(20, Math.floor(text.length / 45));
  const wordScore = Math.min(25, usefulWords);
  const sectionScore = Math.min(30, sectionCount * 8);
  const keywordScore = Math.min(25, usefulKeywordCount * 3);
  const metadataPenalty = Math.min(35, metadataLineCount * 8);
  let score = Math.max(
    0,
    Math.min(100, lengthScore + wordScore + sectionScore + keywordScore - metadataPenalty),
  );
  if (garbageTokenRatio > 0.22) score = Math.min(score, 35);
  if (readabilityScore < 72) score = Math.min(score, 35);
  if (sectionCount === 0 && usefulKeywordCount < 6) score = Math.min(score, 35);
  if (tokens.length < 18) score = Math.min(score, 35);
  return {
    score,
    usefulWords,
    sectionCount,
    usefulKeywordCount,
    garbageTokenRatio,
    readabilityScore,
    metadataRemoved,
    level: score >= 75 ? "high" : score >= 45 ? "moderate" : "low",
  };
}

function buildProviderInput(input: {
  readonly cvText: string;
  readonly jobTitle: string;
  readonly roleSummary: string;
  readonly responsibilities: readonly string[];
  readonly requiredSkills: readonly string[];
  readonly niceToHaveSkills: readonly string[];
  readonly competencies: readonly string[];
}): string {
  return [
    "You are screening a CV for job-related fit only. Do not infer protected or sensitive attributes. Return strict JSON only.",
    "AI screening is advisory. HR must review before making decisions.",
    `Job title: ${input.jobTitle}`,
    `Role summary: ${input.roleSummary}`,
    `Responsibilities: ${input.responsibilities.join("; ")}`,
    `Required skills: ${input.requiredSkills.join("; ")}`,
    `Nice-to-have skills: ${input.niceToHaveSkills.join("; ")}`,
    `Competencies: ${input.competencies.join("; ")}`,
    `CV text:\n${input.cvText.slice(0, 24000)}`,
  ].join("\n\n");
}

async function persistScreeningResult(
  companyId: string,
  applicationId: string,
  result: CvScreeningResult,
  provider: { readonly provider: string; readonly model: string },
): Promise<void> {
  await prisma.applicationCvScreening.update({
    where: { companyId_applicationId: { companyId, applicationId } },
    data: {
      screeningStatus: "COMPLETE",
      matchScore: result.matchScore,
      recommendation: toPrismaRecommendation(result.recommendation),
      confidence: toPrismaConfidence(result.confidence),
      hrSummary: result.hrSummary,
      matchedSkillsJson: result.matchedSkills,
      missingSkillsJson: result.missingSkills,
      experienceMatch: result.experienceMatch,
      responsibilityMatch: result.responsibilityMatch,
      educationMatch: result.educationMatch,
      concernsJson: result.concerns,
      focusAreasJson: result.suggestedInterviewFocusAreas,
      evidenceJson: result.evidenceExcerpts,
      limitationsJson: result.limitations,
      provider: provider.provider,
      model: provider.model,
      failureCode: null,
      failureMessageSafe: null,
      completedAt: new Date(),
    },
  });
}

async function markExtractionFailed(id: string, code: string, message: string): Promise<void> {
  await prisma.applicationCvScreening.update({
    where: { id },
    data: {
      extractionStatus: "FAILED",
      screeningStatus: "FAILED",
      failureCode: code,
      failureMessageSafe: message,
    },
  });
}

async function loadScreening(companyId: string, applicationId: string) {
  const screening = await prisma.applicationCvScreening.findUnique({
    where: { companyId_applicationId: { companyId, applicationId } },
  });
  if (screening === null) {
    throw new CvScreeningError("CV screening record was not found.", "SCREENING_NOT_FOUND", false);
  }
  return screening;
}

function readResponseText(response: Awaited<ReturnType<OpenAI["responses"]["create"]>>): string {
  const outputText = (response as { readonly output_text?: unknown }).output_text;
  if (typeof outputText === "string" && outputText.trim().length > 0) return outputText;
  throw new CvScreeningError(
    "OpenAI response did not include JSON text.",
    "MALFORMED_OUTPUT",
    false,
  );
}

function normalizeOpenAIError(error: unknown): CvScreeningError {
  if (error instanceof CvScreeningError) return error;
  if (error instanceof OpenAI.APIError) {
    const status = readErrorStatus(error.status);
    const code = readErrorString(error.code, "openai_error");
    const type = readErrorString(error.type, "api_error");
    const requestId = readErrorString(error.requestID, "none");
    return new CvScreeningError(
      `OpenAI CV screening request failed. status=${String(status)} code=${code} type=${type} message=${sanitizeMessage(error.message)}`,
      status === 401 ? "PROVIDER_AUTH_FAILED" : "PROVIDER_RETRYABLE",
      status !== 401 && status !== 400,
      { status, code, type, requestId: requestId === "none" ? null : requestId },
    );
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new CvScreeningError("OpenAI CV screening request timed out.", "PROVIDER_TIMEOUT", true);
  }
  return new CvScreeningError(
    error instanceof Error ? sanitizeMessage(error.message) : "OpenAI CV screening request failed.",
    "PROVIDER_RETRYABLE",
    true,
  );
}

function readErrorStatus(value: unknown): number | "unknown" {
  return typeof value === "number" ? value : "unknown";
}

function readErrorString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, 200)
    : fallback;
}

function createInsufficientEvidenceResult(reason: string): CvScreeningResult {
  return {
    matchScore: 0,
    recommendation: "Maybe",
    confidence: "insufficient_evidence",
    hrSummary:
      reason ===
      "PDF text could not be extracted clearly. Ask candidate to upload DOCX or a selectable text PDF."
        ? "PDF text could not be extracted clearly. Ask candidate to upload DOCX or a selectable text PDF."
        : "The CV could not be screened reliably from the available text.",
    matchedSkills: [],
    missingSkills: [],
    experienceMatch: "Insufficient evidence.",
    responsibilityMatch: "Insufficient evidence.",
    educationMatch: "Insufficient evidence.",
    concerns: [],
    suggestedInterviewFocusAreas: ["Ask the candidate to clarify role-relevant experience."],
    evidenceExcerpts: [],
    limitations: [reason],
  };
}

interface CvTextExtractionResult {
  readonly text: string;
  readonly quality: CvTextExtractionQuality;
  readonly method: string;
  readonly rawLength: number;
  readonly cleanedLength: number;
}

interface CvTextExtractionQuality {
  readonly score: number;
  readonly usefulWords: number;
  readonly sectionCount: number;
  readonly usefulKeywordCount: number;
  readonly garbageTokenRatio: number;
  readonly readabilityScore: number;
  readonly metadataRemoved: boolean;
  readonly level: "high" | "moderate" | "low";
}

const RESUME_SECTION_PATTERNS = [
  /\b(summary|profile|objective)\b/iu,
  /\b(experience|employment|work history)\b/iu,
  /\b(projects?|portfolio)\b/iu,
  /\b(skills?|technical skills|technologies)\b/iu,
  /\b(education|degree|university|college)\b/iu,
  /\b(certifications?|licenses?)\b/iu,
] as const;

const RESUME_KEYWORDS = [
  "summary",
  "profile",
  "experience",
  "employment",
  "project",
  "skills",
  "technical",
  "education",
  "certification",
  "engineer",
  "developer",
  "software",
  "frontend",
  "backend",
  "full stack",
  "typescript",
  "javascript",
  "react",
  "node",
  "python",
  "sql",
  "mysql",
  "postgresql",
  "api",
  "cloud",
  "aws",
  "azure",
  "docker",
  "prisma",
  "openai",
] as const;

const COMMON_RESUME_WORDS = new Set([
  ...RESUME_KEYWORDS,
  "professional",
  "built",
  "building",
  "focused",
  "recruitment",
  "platform",
  "platforms",
  "workflow",
  "workflows",
  "candidate",
  "customer",
  "support",
  "systems",
  "computer",
  "science",
]);

const KNOWN_MIXED_CASE_WORDS = new Set([
  "typescript",
  "javascript",
  "openai",
  "postgresql",
  "mysql",
  "github",
  "linkedin",
]);

function readScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new CvScreeningError(
      "CV screening match score must be an integer from 0 to 100.",
      "MALFORMED_OUTPUT",
      false,
    );
  }
  return value;
}

function readEnum<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value === "string" && values.includes(value as T)) return value as T;
  throw new CvScreeningError(
    "CV screening output contained an invalid enum value.",
    "MALFORMED_OUTPUT",
    false,
  );
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim().slice(0, 3000);
  throw new CvScreeningError(
    `CV screening output was missing ${field}.`,
    "MALFORMED_OUTPUT",
    false,
  );
}

function readStringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new CvScreeningError(
      "CV screening output list field was invalid.",
      "MALFORMED_OUTPUT",
      false,
    );
  }
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 1000))
    .slice(0, 20);
}

function readSummary(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const summary = (value as { summary?: unknown }).summary;
  return typeof summary === "string" ? summary : "";
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readCompetencies(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null && "name" in item) {
        return String((item as { name: unknown }).name);
      }
      return "";
    })
    .filter(Boolean);
}

function toPrismaRecommendation(value: CvScreeningResult["recommendation"]) {
  if (value === "Recommended") return "RECOMMENDED";
  if (value === "Not Recommended") return "NOT_RECOMMENDED";
  return "MAYBE";
}

function toPrismaConfidence(value: CvScreeningResult["confidence"]) {
  return value.toUpperCase() as "HIGH" | "MODERATE" | "LIMITED" | "INSUFFICIENT_EVIDENCE";
}

function sanitizeMessage(value: string): string {
  return value.replace(/sk-[A-Za-z0-9_-]+/gu, "[redacted]").slice(0, 600);
}

interface CvScreeningResult {
  readonly matchScore: number;
  readonly recommendation: "Recommended" | "Maybe" | "Not Recommended";
  readonly confidence: "high" | "moderate" | "limited" | "insufficient_evidence";
  readonly hrSummary: string;
  readonly matchedSkills: readonly string[];
  readonly missingSkills: readonly string[];
  readonly experienceMatch: string;
  readonly responsibilityMatch: string;
  readonly educationMatch: string;
  readonly concerns: readonly string[];
  readonly suggestedInterviewFocusAreas: readonly string[];
  readonly evidenceExcerpts: readonly string[];
  readonly limitations: readonly string[];
}

const cvScreeningJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "matchScore",
    "recommendation",
    "confidence",
    "hrSummary",
    "matchedSkills",
    "missingSkills",
    "experienceMatch",
    "responsibilityMatch",
    "educationMatch",
    "concerns",
    "suggestedInterviewFocusAreas",
    "cvEvidenceExcerpts",
    "limitations",
  ],
  properties: {
    matchScore: { type: "integer", minimum: 0, maximum: 100 },
    recommendation: { type: "string", enum: ["Recommended", "Maybe", "Not Recommended"] },
    confidence: { type: "string", enum: ["high", "moderate", "limited", "insufficient_evidence"] },
    hrSummary: { type: "string" },
    matchedSkills: { type: "array", items: { type: "string" } },
    missingSkills: { type: "array", items: { type: "string" } },
    experienceMatch: { type: "string" },
    responsibilityMatch: { type: "string" },
    educationMatch: { type: "string" },
    concerns: { type: "array", items: { type: "string" } },
    suggestedInterviewFocusAreas: { type: "array", items: { type: "string" } },
    cvEvidenceExcerpts: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
  },
} as const;
