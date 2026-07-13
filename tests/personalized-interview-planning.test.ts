import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("personalized interview planning", () => {
  it("adds tenant-scoped application interview plan storage and invitation linkage", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source(
      "prisma/migrations/20260713180000_personalized_interview_planning/migration.sql",
    );

    expect(schema).toContain("model ApplicationInterviewPlan");
    expect(schema).toContain("enum PersonalizedInterviewPlanStatus");
    expect(schema).toContain('interviewPlanVersionId String? @map("interview_plan_version_id")');
    expect(schema).toContain('@@unique([companyId, applicationId], map: "app_int_plan_app_key")');
    expect(migration).toContain("CREATE TABLE `application_interview_plans`");
    expect(migration).toContain("ADD COLUMN `interview_plan_version_id`");
    expect(migration).toContain("CONSTRAINT `ci_plan_version_fk`");
  });

  it("generates questions from JD intelligence, CV screening, gaps, and HR context", () => {
    const service = source("src/modules/personalized-interviews/service.ts");

    expect(service).toContain("requiredSkillsJson");
    expect(service).toContain("niceToHaveSkillsJson");
    expect(service).toContain("matchedSkillsJson");
    expect(service).toContain("missingSkillsJson");
    expect(service).toContain("concernsJson");
    expect(service).toContain("focusAreasJson");
    expect(service).toContain("extractedText");
    expect(service).toContain("latestDecision");
    expect(service).toContain("gap_validation");
    expect(service).toContain("project_deep_dive");
  });

  it("stores internal HR review details while projecting only candidate-safe prompts", () => {
    const service = source("src/modules/personalized-interviews/service.ts");
    const interviewRepository = source("src/modules/interviews/prisma-interview-repository.ts");

    expect(service).toContain("expectedSignals");
    expect(service).toContain("redFlags");
    expect(service).toContain("followUps");
    expect(interviewRepository).toContain("invitation.interviewPlanVersionId");
    expect(interviewRepository).toContain("prompt,");
    expect(interviewRepository).not.toContain("expectedSignals:");
    expect(interviewRepository).not.toContain("redFlags:");
    expect(interviewRepository).not.toContain("followUps:");
  });

  it("requires a ready personalized plan before sending an interview invite", () => {
    const actions = source("src/server/hr-workspace/actions.ts");
    const jobPage = source("src/app/(workspace)/jobs/[jobId]/page.tsx");

    expect(actions).toContain(
      "Generate and review a personalized interview before sending the invite.",
    );
    expect(actions).toContain(
      "interviewPlanVersionId: personalizedPlan.personalizedInterviewPlanVersionId",
    );
    expect(jobPage).toContain("Generate personalized interview");
    expect(jobPage).toContain("View questions");
    expect(jobPage).toContain("!personalizedReady");
  });

  it("adds HR preview and local diagnostics for safe troubleshooting", () => {
    const reviewPage = source(
      "src/app/(workspace)/jobs/[jobId]/applications/[applicationId]/interview-plan/page.tsx",
    );
    const packageJson = source("package.json");
    const diagnostic = source("scripts/local-personalized-interview-diagnostic.ts");

    expect(reviewPage).toContain("AI basis summary");
    expect(reviewPage).toContain("Candidate-safe questions");
    expect(reviewPage).toContain("Candidates do not see screening scores");
    expect(packageJson).toContain("local:personalized-interview-diagnostic");
    expect(diagnostic).toContain("Safe OpenAI error");
  });
});
