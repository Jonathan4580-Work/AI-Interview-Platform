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

    expect(hrJobPage).toContain("View screening details");
    expect(hrJobPage).toContain("AI screening is advisory");
    expect(hrJobPage).toContain("Screening pending");
    expect(hrJobPage).toContain("match score");
    expect(candidateDashboard).not.toContain("AI screening");
    expect(candidateDashboard).not.toContain("Match score");
    expect(applyPage).not.toContain("AI screening");
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
    expect(diagnostic).toContain("Extraction quality score");
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

  it("extracts paragraph and table text from DOCX resumes", () => {
    const docx = createSyntheticDocx(`
      <w:document>
        <w:body>
          <w:p><w:r><w:t>Jane Candidate</w:t></w:r></w:p>
          <w:p><w:r><w:t>Experience Product support specialist</w:t></w:r></w:p>
          <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Skills</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Customer discovery SQL Excel</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
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
    expect(extracted.quality.score).toBeGreaterThanOrEqual(45);
  });

  it("scores cleaned resume text higher than metadata-heavy text", () => {
    const resume = scoreExtractedText(
      "Summary Backend engineer Experience Built APIs Projects Interview platform Skills TypeScript Prisma MySQL Education Computer Science",
      true,
    );
    const metadata = scoreExtractedText(
      "D:20260711204028 anonymous Producer xref obj endobj",
      false,
    );

    expect(resume.score).toBeGreaterThan(metadata.score);
    expect(metadata.score).toBeLessThan(45);
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
