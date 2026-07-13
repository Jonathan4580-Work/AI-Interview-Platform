import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("HR verification workspace", () => {
  it("adds HR verification decision outcomes without automatic hiring", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source(
      "prisma/migrations/20260713193000_hr_verification_workspace/migration.sql",
    );
    const actions = source("src/server/hr-workspace/actions.ts");

    expect(schema).toContain("HR_VERIFIED");
    expect(schema).toContain("REQUEST_ANOTHER_AI_INTERVIEW");
    expect(migration).toContain("MODIFY COLUMN `decision` ENUM");
    expect(actions).toContain("recordHrVerificationAction");
    expect(actions).toContain("verificationNote");
    expect(actions).toContain("application.hr_verification_recorded");
    expect(actions).not.toContain('status: "HIRED"');
  });

  it("builds a tenant-scoped HR verification packet from existing evidence", () => {
    const queries = source("src/server/hr-workspace/queries.ts");

    expect(queries).toContain("getApplicationVerificationDetail");
    expect(queries).toContain("companyId_id: { companyId: context.tenant.companyId");
    expect(queries).toContain("cvScreenings");
    expect(queries).toContain("personalizedInterviewPlans");
    expect(queries).toContain("decisionHistory");
    expect(queries).toContain("monitoringEvents");
    expect(queries).toContain("activeVersion");
  });

  it("adds a dedicated HR verification route with controlled human decisions", () => {
    const page = source("src/app/(workspace)/applications/[applicationId]/verification/page.tsx");

    expect(page).toContain("HR verification");
    expect(page).toContain("AI output is decision support");
    expect(page).toContain("Approve HR interview");
    expect(page).toContain("Request another AI interview");
    expect(page).toContain("Put on hold");
    expect(page).toContain("Reject after review");
    expect(page).toContain("Monitoring warnings");
    expect(page).toContain("Decision history");
  });

  it("links HR verification from job, candidate, and interview surfaces", () => {
    const jobPage = source("src/app/(workspace)/jobs/[jobId]/page.tsx");
    const candidatePage = source("src/app/(workspace)/candidates/[candidateId]/page.tsx");
    const interviewsPage = source("src/app/(workspace)/interviews/page.tsx");

    expect(jobPage).toContain("/verification");
    expect(jobPage).toContain("HR verification");
    expect(candidatePage).toContain("Open HR verification");
    expect(interviewsPage).toContain("HR verification");
  });
});
