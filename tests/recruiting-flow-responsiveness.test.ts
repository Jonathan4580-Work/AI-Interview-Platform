import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("recruiting flow responsiveness", () => {
  it("adds pending states to job creation and JD analysis actions", () => {
    const newJobPage = source("src/app/(workspace)/jobs/new/page.tsx");
    const jdInput = source("src/app/(workspace)/jobs/new/jd-input-client.tsx");

    expect(newJobPage).toContain("Creating job...");
    expect(jdInput).toContain("Analyzing JD...");
    expect(jdInput).toContain("Paste a job description or upload a PDF/DOCX file.");
  });

  it("adds pending states to JD review save and publish actions", () => {
    const reviewPage = source("src/app/(workspace)/jobs/[jobId]/review/page.tsx");

    expect(reviewPage).toContain("Publishing...");
    expect(reviewPage).toContain("Saving draft...");
  });

  it("adds pending and confirmation states to job edits and status changes", () => {
    const editPage = source("src/app/(workspace)/jobs/[jobId]/edit/page.tsx");
    const statusForm = source("src/app/(workspace)/jobs/[jobId]/job-status-form.tsx");

    expect(editPage).toContain("Saving changes...");
    expect(editPage).toContain("JobStatusForm");
    expect(statusForm).toContain("Confirm close?");
    expect(statusForm).toContain("Closing job...");
    expect(statusForm).toContain("Reopening job...");
  });
});
