import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("application command center", () => {
  it("adds a tenant-scoped application command center route", () => {
    const page = source("src/app/(workspace)/applications/[applicationId]/page.tsx");

    expect(page).toContain('requireHrWorkspaceContext("applications:read")');
    expect(page).toContain("getApplicationVerificationDetail(context, applicationId)");
    expect(page).toContain("Application summary");
    expect(page).toContain("Next action");
    expect(page).toContain("AI CV screening");
    expect(page).toContain("Interview and report");
    expect(page).toContain("Decision and handoff");
    expect(page).toContain("AI screening, interview evaluation, and monitoring");
  });

  it("links job and candidate application cards to the command center", () => {
    const jobPage = source("src/app/(workspace)/jobs/[jobId]/page.tsx");
    const candidatePage = source("src/app/(workspace)/candidates/[candidateId]/page.tsx");

    expect(jobPage).toContain("href={`/applications/${application.id}`}");
    expect(jobPage).toContain("Open application");
    expect(candidatePage).toContain("href={`/applications/${application.id}`}");
    expect(candidatePage).toContain("Open application");
  });

  it("keeps HR review and report access explicit from the command center", () => {
    const page = source("src/app/(workspace)/applications/[applicationId]/page.tsx");

    expect(page).toContain("href={`/applications/${application.id}/verification`}");
    expect(page).toContain("href={`/interviews/${latestInterview.id}`}");
    expect(page).toContain("Open HR review");
    expect(page).toContain("View interview results");
  });
});
