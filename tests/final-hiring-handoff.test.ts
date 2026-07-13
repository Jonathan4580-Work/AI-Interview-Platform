import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("final hiring handoff", () => {
  it("adds real final-outcome metrics to the HR dashboard", () => {
    const queries = source("src/server/hr-workspace/queries.ts");
    const dashboard = source("src/app/(workspace)/dashboard/page.tsx");

    expect(queries).toContain("hiredCandidates");
    expect(queries).toContain('status: "HIRED"');
    expect(queries).toContain('status: { in: ["NOT_SELECTED", "REJECTED"] }');
    expect(dashboard).toContain('label: "Hired"');
    expect(dashboard).toContain('label: "Not selected"');
  });

  it("surfaces final HR outcomes on job application cards", () => {
    const page = source("src/app/(workspace)/jobs/[jobId]/page.tsx");

    expect(page).toContain("readFinalOutcome(application.metadataJson, application.status)");
    expect(page).toContain("Candidate hired");
    expect(page).toContain("Candidate not selected");
    expect(page).toContain("Target onboarding date");
    expect(page).toContain('case "HIRED"');
    expect(page).toContain('return "Hired"');
    expect(page).not.toContain("outcomeNote");
  });

  it("keeps candidate final-outcome tracking on the completed step", () => {
    const page = source("src/app/candidate/applications/page.tsx");

    expect(page).toContain('status.includes("Hired")');
    expect(page).toContain('status.includes("Selected")');
    expect(page).toContain('return "Completed"');
  });
});
