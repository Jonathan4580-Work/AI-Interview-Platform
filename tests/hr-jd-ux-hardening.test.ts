import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("JD job creation UX hardening", () => {
  it("wires job detail actions to implemented routes and confirmation", () => {
    const page = source("src/app/(workspace)/jobs/[jobId]/page.tsx");
    const statusForm = source("src/app/(workspace)/jobs/[jobId]/job-status-form.tsx");

    expect(page).toContain("href={`/jobs/${job.id}/edit`}");
    expect(page).toContain("href={`/jobs/${job.id}/review`}");
    expect(page).toContain("JobStatusForm");
    expect(statusForm).toContain("Confirm close");
    expect(statusForm).toContain("Reopen job");
    expect(statusForm).toContain("Saving...");
  });

  it("exposes real edit fields for JD-created jobs", () => {
    const page = source("src/app/(workspace)/jobs/[jobId]/edit/page.tsx");
    const actions = source("src/server/hr-workspace/actions.ts");

    for (const field of [
      'name="title"',
      'name="summary"',
      'name="details"',
      'name="locationText"',
      'name="departmentText"',
      'name="experienceText"',
      'name="responsibilities"',
      'name="requiredSkills"',
      'name="niceToHaveSkills"',
      'name="status"',
    ]) {
      expect(page).toContain(field);
    }
    expect(actions).toContain("requiredSkillsJson");
    expect(actions).toContain("responsibilitiesJson");
    expect(actions).toContain("closedAt: status ===");
  });

  it("shows paste/upload autofill without importing OpenAI", () => {
    const client = source("src/app/(workspace)/jobs/new/jd-input-client.tsx");
    const parser = source("src/modules/jobs/jd-local-autofill.ts");

    expect(client).toContain("AI analysis has not run yet");
    expect(client).toContain("OpenAI is not called until you click Analyze JD");
    expect(client).toContain("Upload PDF or DOCX");
    expect(parser).not.toContain("openai");
    expect(parser).not.toContain("analyzeJobDescription");
  });

  it("keeps JD review save and publish actions wired", () => {
    const page = source("src/app/(workspace)/jobs/[jobId]/review/page.tsx");
    const actions = source("src/server/hr-workspace/actions.ts");

    expect(page).toContain("saveJdReviewAction");
    expect(page).toContain("publishJdJobAction");
    expect(page).toContain("Save draft");
    expect(page).toContain("Publish job");
    expect(actions).toContain("jd.job_profile_edited");
    expect(actions).toContain("jd.job_published");
  });
});
