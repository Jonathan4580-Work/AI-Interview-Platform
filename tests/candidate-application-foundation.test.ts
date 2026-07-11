import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  normalizeCandidateStatus,
  validateCvFile,
} from "../src/server/public-careers/candidate-application";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("candidate application foundation", () => {
  it("accepts PDF and DOCX CV uploads and rejects unsupported files", () => {
    expect(
      validateCvFile({
        fileName: "jonathan-cv.pdf",
        contentType: "application/pdf",
        sizeBytes: 1234,
      }),
    ).toEqual({ ok: true });
    expect(
      validateCvFile({
        fileName: "jonathan-cv.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 1234,
      }),
    ).toEqual({ ok: true });
    expect(
      validateCvFile({
        fileName: "jonathan-cv.exe",
        contentType: "application/octet-stream",
        sizeBytes: 1234,
      }),
    ).toEqual({ ok: false, message: "Upload a PDF or DOCX CV." });
  });

  it("requires a non-empty CV within the file-size boundary", () => {
    expect(
      validateCvFile({
        fileName: "empty.pdf",
        contentType: "application/pdf",
        sizeBytes: 0,
      }),
    ).toEqual({ ok: false, message: "Upload a non-empty CV file." });
    expect(
      validateCvFile({
        fileName: "large.pdf",
        contentType: "application/pdf",
        sizeBytes: 11 * 1024 * 1024,
      }),
    ).toEqual({ ok: false, message: "CV files must be 10 MB or smaller." });
  });

  it("maps existing application statuses to candidate-facing labels", () => {
    expect(normalizeCandidateStatus("NEW")).toBe("Submitted");
    expect(normalizeCandidateStatus("IN_REVIEW")).toBe("Under HR Review");
    expect(normalizeCandidateStatus("INTERVIEW")).toBe("Interview Invited");
    expect(normalizeCandidateStatus("REJECTED")).toBe("Not Selected");
  });

  it("replaces the public apply placeholder with real candidate auth and CV submission", () => {
    const applyPage = source("src/app/careers/[companySlug]/jobs/[jobSlug]/apply/page.tsx");
    const actions = source("src/server/public-careers/actions.ts");

    expect(applyPage).toContain("Create candidate account");
    expect(applyPage).toContain("Already applied before?");
    expect(applyPage).toContain("Submit application");
    expect(applyPage).toContain('accept=".pdf,.docx');
    expect(actions).toContain("submitPublicApplicationAction");
    expect(actions).toContain('consent !== "on"');
    expect(actions).toContain("LocalFilesystemStorageProvider");
    expect(applyPage).not.toContain("Candidate applications coming soon");
  });

  it("keeps candidate accounts separate from HR authentication", () => {
    const candidateAuth = source("src/server/public-careers/candidate-auth.ts");
    const workspaceContext = source("src/server/hr-workspace/context.ts");

    expect(candidateAuth).toContain("aptly_candidate_account_session");
    expect(candidateAuth).not.toContain("authCookieNames.session");
    expect(workspaceContext).toContain("authCookieNames.session");
  });

  it("shows candidate applications and HR public submissions", () => {
    const dashboardPage = source("src/app/candidate/applications/page.tsx");
    const hrJobPage = source("src/app/(workspace)/jobs/[jobId]/page.tsx");
    const hrQueries = source("src/server/hr-workspace/queries.ts");

    expect(dashboardPage).toContain("My applications");
    expect(dashboardPage).toContain("View job");
    expect(hrJobPage).toContain("CV uploaded");
    expect(hrJobPage).toContain("Screening not started");
    expect(hrQueries).toContain("documents:");
  });
});
