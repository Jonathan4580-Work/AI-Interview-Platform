import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("candidate workspace hardening", () => {
  it("renders candidate list operational signals for HR scanning", () => {
    const page = source("src/app/(workspace)/candidates/page.tsx");
    const queries = source("src/server/hr-workspace/queries.ts");

    expect(page).toContain("CandidateSignal");
    expect(page).toContain("Latest application");
    expect(page).toContain("Report ready");
    expect(page).toContain("CV screened");
    expect(page).toContain("CV uploaded");
    expect(queries).toContain("cvScreenings");
    expect(queries).toContain("hrReports");
    expect(queries).toContain("documents");
  });

  it("uses loading states for candidate create and edit submits", () => {
    const createPage = source("src/app/(workspace)/candidates/new/page.tsx");
    const editPage = source("src/app/(workspace)/candidates/[candidateId]/edit/page.tsx");

    expect(createPage).toContain("PendingSubmitButton");
    expect(createPage).toContain("Adding candidate...");
    expect(editPage).toContain("PendingSubmitButton");
    expect(editPage).toContain("Saving changes...");
  });

  it("validates application creation and stage updates against tenant and job pipeline", () => {
    const actions = source("src/server/hr-workspace/actions.ts");

    expect(actions).toContain("validateStageForJob");
    expect(actions).toContain("stage?.pipelineId !== pipelineId");
    expect(actions).toContain("Selected pipeline stage does not belong to this job.");
    expect(actions).toContain("This candidate already has an active application for this job.");
    expect(actions).toContain('status: { notIn: ["HIRED", "REJECTED", "WITHDRAWN", "ARCHIVED"] }');
  });
});
