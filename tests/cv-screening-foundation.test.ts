import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync, deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  extractTextFromDocument,
  parseCvScreeningProviderOutput,
  scoreExtractedText,
} from "../src/modules/cv-screening/service";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("AI CV screening foundation", () => {
  it("validates strict provider output before persistence", () => {
    const parsed = parseCvScreeningProviderOutput(
      JSON.stringify({
        matchScore: 72,
        recommendation: "Maybe",
        confidence: "moderate",
        hrSummary: "The CV shows relevant TypeScript and customer-facing project work.",
        matchedSkills: ["TypeScript", "API design"],
        missingSkills: ["PostgreSQL depth"],
        experienceMatch: "The candidate has relevant software delivery experience.",
        responsibilityMatch: "The CV aligns with several backend responsibilities.",
        educationMatch: "Education evidence is limited.",
        concerns: ["Limited database detail"],
        suggestedInterviewFocusAreas: ["Ask about production database work."],
        cvEvidenceExcerpts: ["Built TypeScript APIs for internal tools."],
        limitations: ["CV text extraction may omit formatting."],
      }),
    );

    expect(parsed.matchScore).toBe(72);
    expect(parsed.recommendation).toBe("Maybe");
    expect(parsed.confidence).toBe("moderate");
    expect(parsed.evidenceExcerpts).toContain("Built TypeScript APIs for internal tools.");
  });

  it("rejects malformed or incomplete provider output", () => {
    expect(() => parseCvScreeningProviderOutput("not-json")).toThrow("not valid JSON");
    expect(() =>
      parseCvScreeningProviderOutput(
        JSON.stringify({
          matchScore: 101,
          recommendation: "Hire",
        }),
      ),
    ).toThrow();
  });

  it("wires CV extraction and AI screening into the application workflow", () => {
    const actions = source("src/server/public-careers/actions.ts");
    const handlers = source("src/modules/evaluation/workflow-handlers.ts");
    const localWorker = source("src/workers/local.ts");

    expect(actions).toContain("createCvScreeningWorkflow");
    expect(actions).toContain('stepKey: "cv_text_extraction"');
    expect(actions).toContain('stepKey: "cv_ai_screening"');
    expect(actions).toContain('queueName: "evaluation"');
    expect(handlers).toContain("extractCvTextForApplication");
    expect(handlers).toContain("screenApplicationCv");
    expect(localWorker).toContain('"cv-text-extraction"');
    expect(localWorker).toContain('"cv-screening"');
  });

  it("keeps weak or unavailable CV evidence as advisory insufficient evidence", () => {
    const service = source("src/modules/cv-screening/service.ts");

    expect(service).toContain("createInsufficientEvidenceResult");
    expect(service).toContain("insufficient_evidence");
    expect(service).toContain("The CV could not be screened reliably from the available text.");
    expect(service).toContain("AI screening is advisory. HR must review before making decisions.");
  });

  it("surfaces screening results to HR without exposing them to candidates", () => {
    const hrJobPage = source("src/app/(workspace)/jobs/[jobId]/page.tsx");
    const candidateDashboard = source("src/app/candidate/applications/page.tsx");
    const applyPage = source("src/app/careers/[companySlug]/jobs/[jobSlug]/apply/page.tsx");

    expect(hrJobPage).toContain("AI screening result");
    expect(hrJobPage).toContain("AI screening supports HR review");
    expect(hrJobPage).toContain("Screening pending");
    expect(hrJobPage).toContain("match score");
    expect(candidateDashboard).not.toContain("AI screening");
    expect(candidateDashboard).not.toContain("Match score");
    expect(applyPage).not.toContain("Match score");
    expect(applyPage).not.toContain("recommendation");
  });

  it("adds a local diagnostic command for CV screening state", () => {
    const packageJson = source("package.json");
    const diagnostic = source("scripts/local-cv-screening-diagnostic.ts");

    expect(packageJson).toContain("local:cv-screening-diagnostic");
    expect(diagnostic).toContain("CV screening diagnostic");
    expect(diagnostic).toContain("extractionStatus");
    expect(diagnostic).toContain("screeningStatus");
    expect(diagnostic).toContain("CV filename");
    expect(diagnostic).toContain("CV MIME type");
    expect(diagnostic).toContain("PDF extraction method used");
    expect(diagnostic).toContain("Raw extracted length");
    expect(diagnostic).toContain("Cleaned extracted length");
    expect(diagnostic).toContain("Extraction quality score");
    expect(diagnostic).toContain("Readability score");
    expect(diagnostic).toContain("Garbage token ratio");
    expect(diagnostic).toContain("Resume section count");
    expect(diagnostic).toContain("Useful keyword count");
    expect(diagnostic).toContain("AI screening skipped because extraction was unreadable");
    expect(diagnostic).toContain("Metadata removed");
    expect(diagnostic).toContain("Extracted CV text preview");
  });

  it("removes PDF metadata and extracts visible resume text from compressed streams", () => {
    const pdf = createSyntheticPdf([
      "D:20260711204028+00'00'",
      "opensource anonymous",
      "Jonathan Perera",
      "Summary Software engineer building TypeScript recruiting systems",
      "Experience Built PostgreSQL APIs and worker queues",
      "Skills TypeScript React Prisma MySQL OpenAI",
      "Education BSc Computer Science",
    ]);

    const extracted = extractTextFromDocument(pdf, "application/pdf", "jonathan-cv.pdf");

    expect(extracted.text).toContain("Jonathan Perera");
    expect(extracted.text).toContain("Skills TypeScript React Prisma MySQL OpenAI");
    expect(extracted.text).not.toContain("D:20260711204028");
    expect(extracted.text).not.toContain("opensource anonymous");
    expect(extracted.quality.metadataRemoved).toBe(true);
    expect(extracted.quality.score).toBeGreaterThanOrEqual(45);
  });

  it("treats metadata-only PDF extraction as insufficient quality", () => {
    const pdf = createSyntheticPdf([
      "D:20260711204028+00'00'",
      "opensource anonymous",
      "Producer",
      "Random/garbled text present",
    ]);

    const extracted = extractTextFromDocument(pdf, "application/pdf", "bad-cv.pdf");

    expect(extracted.text).not.toContain("D:20260711204028");
    expect(extracted.quality.metadataRemoved).toBe(true);
    expect(extracted.quality.score).toBeLessThan(45);
  });

  it("extracts selectable PDF text encoded through a ToUnicode CMap", () => {
    const pdf = createSelectableCmapPdf([
      "Professional summary Software engineer focused on recruitment platforms",
      "Skills TypeScript React Prisma MySQL OpenAI",
      "Experience Built browser interview workflows and worker queues",
      "Projects Aptly AI screening workflow",
      "Education Computer Science",
    ]);

    const extracted = extractTextFromDocument(pdf, "application/pdf", "selectable-cv.pdf");

    expect(extracted.method).toBe("pdf_stream_cmap");
    expect(extracted.rawLength).toBeGreaterThan(0);
    expect(extracted.cleanedLength).toBeGreaterThan(0);
    expect(extracted.text).toContain("Professional summary");
    expect(extracted.text).toContain("Skills TypeScript React Prisma MySQL OpenAI");
    expect(extracted.text).toContain("Projects Aptly AI screening workflow");
    expect(extracted.quality.score).toBeGreaterThanOrEqual(60);
  });

  it("scores corrupted selectable PDF glyph text as unreadable", () => {
    const corrupted = scoreExtractedText(
      "kFfAg WFt DFpFnoNaFwg Jonathan Th oma RftnF UI AoaNowFw kFfAg DFaNoNaFwg WFt RftnF DFpFnoNaFwg",
      true,
    );

    expect(corrupted.score).toBeLessThan(45);
    expect(corrupted.readabilityScore).toBeLessThan(72);
    expect(corrupted.garbageTokenRatio).toBeGreaterThan(0.22);
    expect(corrupted.sectionCount).toBe(0);
  });

  it("keeps unreadable PDF extraction away from OpenAI screening", () => {
    const service = source("src/modules/cv-screening/service.ts");

    expect(service).toContain("qualityScore < 45");
    expect(service).toContain("insufficient-evidence");
    expect(service).toContain("PDF text could not be extracted clearly");
    expect(service.indexOf("qualityScore < 45")).toBeLessThan(service.indexOf("new OpenAI"));
  });

  it("extracts paragraph and table text from DOCX resumes", () => {
    const docx = createSyntheticDocx(`
      <w:document>
        <w:body>
          <w:p><w:r><w:t>Jane Candidate</w:t></w:r></w:p>
          <w:p><w:r><w:t>Professional summary Customer operations analyst building support workflows</w:t></w:r></w:p>
          <w:p><w:r><w:t>Experience Product support specialist</w:t></w:r></w:p>
          <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Skills</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Customer discovery SQL Excel</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
          <w:p><w:r><w:t>Projects Improved reporting and application review processes</w:t></w:r></w:p>
          <w:p><w:r><w:t>Education Diploma in Business</w:t></w:r></w:p>
        </w:body>
      </w:document>
    `);

    const extracted = extractTextFromDocument(
      docx,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "jane-cv.docx",
    );

    expect(extracted.text).toContain("Jane Candidate");
    expect(extracted.text).toContain("Customer discovery SQL Excel");
    expect(extracted.quality.score).toBeGreaterThanOrEqual(75);
  });

  it("scores cleaned resume text higher than metadata-heavy text", () => {
    const resume = scoreExtractedText(
      "Professional summary Backend software engineer with five years of experience building recruiting platforms and workflow systems. Experience Built TypeScript APIs, React interfaces, Prisma services, MySQL reporting, PostgreSQL integrations, queue workers, and OpenAI evaluation tooling. Projects Interview platform, candidate application system, CV screening workflow, and reporting dashboard. Skills TypeScript JavaScript React Node Prisma MySQL PostgreSQL Docker OpenAI. Education Bachelor of Computer Science.",
      true,
    );
    const metadata = scoreExtractedText(
      "D:20260711204028 anonymous Producer xref obj endobj",
      false,
    );

    expect(resume.score).toBeGreaterThan(metadata.score);
    expect(resume.score).toBeGreaterThanOrEqual(75);
    expect(metadata.score).toBeLessThan(45);
  });

  it("shows candidates that DOCX is recommended for screening accuracy", () => {
    const applyControls = source(
      "src/app/careers/[companySlug]/jobs/[jobSlug]/apply/candidate-apply-controls.tsx",
    );
    const hrJobPage = source("src/app/(workspace)/jobs/[jobId]/page.tsx");

    expect(applyControls).toContain("DOCX is recommended for best AI screening accuracy");
    expect(applyControls).toContain("some PDFs may");
    expect(hrJobPage).toContain("PDF text could not be extracted clearly");
  });
});

function createSyntheticPdf(lines: readonly string[]): Buffer {
  const stream = lines.map((line) => `(${escapePdfText(line)}) Tj`).join("\n");
  const compressed = deflateSync(Buffer.from(stream, "utf8"));
  return Buffer.concat([
    Buffer.from("%PDF-1.7\n1 0 obj\n<</Filter /FlateDecode>>\nstream\n", "latin1"),
    compressed,
    Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
  ]);
}

function createSelectableCmapPdf(lines: readonly string[]): Buffer {
  const text = lines.join("\n");
  const chars = Array.from(new Set(Array.from(text)));
  const codeByChar = new Map<string, string>();
  chars.forEach((char, index) => {
    codeByChar.set(char, (index + 1).toString(16).padStart(4, "0"));
  });
  const encodedLines = lines
    .map(
      (line) =>
        `<${Array.from(line)
          .map((char) => codeByChar.get(char) ?? "")
          .join("")}> Tj`,
    )
    .join("\n");
  const cmap = [
    "begincmap",
    "beginbfchar",
    ...chars.map(
      (char) =>
        `<${codeByChar.get(char) ?? "0000"}> <${char.codePointAt(0)?.toString(16).padStart(4, "0") ?? "0000"}>`,
    ),
    "endbfchar",
    "endcmap",
  ].join("\n");
  return Buffer.concat([
    Buffer.from("%PDF-1.7\n1 0 obj\n<</Filter /FlateDecode>>\nstream\n", "latin1"),
    deflateSync(Buffer.from(`${cmap}\nBT\n${encodedLines}\nET`, "utf8")),
    Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
  ]);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\(/gu, "\\(").replace(/\)/gu, "\\)");
}

function createSyntheticDocx(documentXml: string): Buffer {
  const name = "word/document.xml";
  const data = deflateRawSync(Buffer.from(documentXml, "utf8"));
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(Buffer.byteLength(name), 26);
  return Buffer.concat([header, Buffer.from(name, "utf8"), data]);
}
