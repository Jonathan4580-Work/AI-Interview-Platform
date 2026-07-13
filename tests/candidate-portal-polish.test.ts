import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("candidate portal polish", () => {
  it("renders a candidate home with next actions and preparation guidance", () => {
    const page = source("src/app/candidate/page.tsx");

    expect(page).toContain("Next action");
    expect(page).toContain("Recent applications");
    expect(page).toContain("Preparation");
    expect(page).toContain("Choose time");
    expect(page).toContain("Track your Aptly applications");
    expect(page).not.toContain("AI screening");
    expect(page).not.toContain("matchScore");
  });

  it("renders candidate applications with timeline, metrics, and final outcome messaging", () => {
    const page = source("src/app/candidate/applications/page.tsx");

    expect(page).toContain("Track submitted roles, requested actions, interview progress");
    expect(page).toContain("Pending actions");
    expect(page).toContain("StatusTile");
    expect(page).toContain("Choose interview time");
    expect(page).toContain("Offer outcome recorded");
    expect(page).toContain("Application review completed");
    expect(page).toContain("Decision");
  });

  it("projects only candidate-safe application progress data", () => {
    const queries = source("src/server/public-careers/candidate-queries.ts");

    expect(queries).toContain("rawStatus");
    expect(queries).toContain("transcriptStatus");
    expect(queries).toContain("evaluationStatus");
    expect(queries).toContain("reportStatus");
    expect(queries).toContain("candidateNextStep");
    expect(queries).not.toContain("cvScreenings");
    expect(queries).not.toContain("hrSummary");
    expect(queries).not.toContain("decisionHistory");
  });
});
