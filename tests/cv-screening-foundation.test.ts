import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseCvScreeningProviderOutput } from "../src/modules/cv-screening/service";

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
    expect(diagnostic).toContain("Extracted CV text preview");
  });
});
