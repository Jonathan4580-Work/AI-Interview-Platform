import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("HR result visibility", () => {
  it("shows a primary results action on ready interviews", () => {
    const page = source("src/app/(workspace)/interviews/page.tsx");

    expect(page).toContain("Results ready");
    expect(page).toContain("View Results");
    expect(page).toContain("View Progress");
    expect(page).toContain("reportReady");
  });

  it("lists ready candidate reports on the reports page", () => {
    const page = source("src/app/(workspace)/reports/page.tsx");
    const queries = source("src/server/hr-workspace/queries.ts");

    expect(page).toContain("Hiring reports");
    expect(page).toContain("Ready reports");
    expect(page).toContain("Needs HR review");
    expect(page).toContain("Processing queue");
    expect(page).toContain("Human decisions");
    expect(page).toContain("Recent candidate reports");
    expect(page).toContain("View report");
    expect(page).toContain("HR review");
    expect(page).toContain("Enterprise module");
    expect(page).toContain("Controlled view");
    expect(queries).toContain("listRecentCandidateReports");
    expect(queries).toContain("getReportsOverviewData");
    expect(queries).toContain('status: "READY"');
    expect(queries).toContain("activeVersionId");
    expect(queries).toContain("unreviewedEvaluations");
    expect(queries).toContain("completedWithoutReport");
  });

  it("shows transcript, evaluation, scores, recommendation, and report status on candidate detail", () => {
    const page = source("src/app/(workspace)/candidates/[candidateId]/page.tsx");

    expect(page).toContain("Latest interview result");
    expect(page).toContain("Interview status");
    expect(page).toContain("Transcript");
    expect(page).toContain("Evaluation summary");
    expect(page).toContain("Scores / competencies");
    expect(page).toContain("Strengths");
    expect(page).toContain("Development areas");
    expect(page).toContain("Recommendation");
    expect(page).toContain("Report status");
    expect(page).toContain("View full report");
  });
});
