import { inflateRawSync } from "node:zlib";

export interface ExtractedJobDescriptionText {
  readonly text: string;
  readonly sourceType: "PASTED_TEXT" | "PDF_UPLOAD" | "DOCX_UPLOAD";
  readonly fileName: string | null;
  readonly mimeType: string | null;
  readonly metadata: Record<string, unknown>;
}

const PDF_TYPES = new Set(["application/pdf"]);
const DOCX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function extractJobDescriptionText(input: {
  readonly pastedText: string;
  readonly file: File | null;
}): Promise<ExtractedJobDescriptionText> {
  const pasted = input.pastedText.trim();
  if (pasted.length > 0) {
    return {
      text: normalizeWhitespace(pasted),
      sourceType: "PASTED_TEXT",
      fileName: null,
      mimeType: null,
      metadata: { source: "paste", characterCount: pasted.length },
    };
  }
  if (input.file === null || input.file.size === 0) {
    throw new Error("Paste a job description or upload a PDF/DOCX file.");
  }
  if (input.file.size > 4 * 1024 * 1024) {
    throw new Error("Job description files must be 4 MB or smaller.");
  }

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const name = input.file.name;
  const mimeType = input.file.type || inferMimeType(name);
  if (PDF_TYPES.has(mimeType)) {
    const text = extractPdfText(bytes);
    return {
      text: requireExtractedText(text, "PDF"),
      sourceType: "PDF_UPLOAD",
      fileName: name,
      mimeType,
      metadata: { source: "pdf", size: input.file.size },
    };
  }
  if (DOCX_TYPES.has(mimeType)) {
    const text = extractDocxText(bytes);
    return {
      text: requireExtractedText(text, "DOCX"),
      sourceType: "DOCX_UPLOAD",
      fileName: name,
      mimeType,
      metadata: { source: "docx", size: input.file.size },
    };
  }
  throw new Error("Upload a PDF or DOCX job description, or paste text directly.");
}

export function extractDocxText(bytes: Buffer): string {
  let offset = 0;
  while (offset < bytes.length - 30) {
    if (bytes.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const compression = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const fileNameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = bytes.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const data = bytes.subarray(dataStart, dataStart + compressedSize);
    if (name === "word/document.xml") {
      const xml = compression === 8 ? inflateRawSync(data).toString("utf8") : data.toString("utf8");
      return normalizeWhitespace(stripXml(xml));
    }
    offset = dataStart + compressedSize;
  }
  return "";
}

export function extractPdfText(bytes: Buffer): string {
  const raw = bytes.toString("latin1");
  const literalMatches = [...raw.matchAll(/\(([^()]{2,500})\)\s*Tj/gu)].map((match) =>
    decodePdfLiteral(match[1]),
  );
  const arrayMatches = [...raw.matchAll(/\[((?:\([^()]{1,500}\)\s*)+)\]\s*TJ/gu)].flatMap((match) =>
    [...match[1].matchAll(/\(([^()]{1,500})\)/gu)].map((part) => decodePdfLiteral(part[1])),
  );
  return normalizeWhitespace([...literalMatches, ...arrayMatches].join(" "));
}

function inferMimeType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function requireExtractedText(text: string, label: string): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length < 80) {
    throw new Error(
      `${label} text extraction did not produce enough readable text. Paste the job description text instead.`,
    );
  }
  return normalized;
}

function stripXml(value: string): string {
  return value
    .replace(/<w:tab\/>/gu, " ")
    .replace(/<\/w:p>/gu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'");
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\n/gu, "\n")
    .replace(/\\r/gu, "\n")
    .replace(/\\t/gu, " ")
    .replace(/\\\(/gu, "(")
    .replace(/\\\)/gu, ")")
    .replace(/\\\\/gu, "\\");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}
