import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("HR interview scheduling", () => {
  it("adds purpose-scoped availability schema without replacing AI interview availability", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source(
      "prisma/migrations/20260713200000_hr_interview_scheduling/migration.sql",
    );

    expect(schema).toContain(
      'purpose               String                          @default("AI_INTERVIEW")',
    );
    expect(schema).toContain(
      'purpose            String                    @default("AI_INTERVIEW")',
    );
    expect(migration).toContain("ADD COLUMN `purpose` VARCHAR(64) NOT NULL DEFAULT 'AI_INTERVIEW'");
    expect(migration).toContain("ias_purpose_job_status_idx");
    expect(migration).toContain("aar_purpose_app_status_idx");
  });

  it("creates and sends tenant-scoped HR interview booking requests only after HR approval", () => {
    const actions = source("src/server/hr-workspace/actions.ts");

    expect(actions).toContain("createHrInterviewSlotAction");
    expect(actions).toContain("sendHrInterviewAvailabilityRequestAction");
    expect(actions).toContain('purpose: "HR_INTERVIEW"');
    expect(actions).toContain('application.status !== "INTERVIEW"');
    expect(actions).toContain("Approve this candidate for HR interview before sending scheduling.");
    expect(actions).toContain("hr_interview.slot_created");
    expect(actions).toContain("hr_interview.scheduling_request_sent");
  });

  it("shows HR scheduling controls only on the verification workspace", () => {
    const page = source("src/app/(workspace)/applications/[applicationId]/verification/page.tsx");
    const queries = source("src/server/hr-workspace/queries.ts");

    expect(page).toContain("HR interview scheduling");
    expect(page).toContain("HR interview status");
    expect(page).toContain("Candidate confirmed");
    expect(page).toContain("Add HR interview slot");
    expect(page).toContain("Send HR interview booking link");
    expect(page).toContain("Open candidate booking");
    expect(page).toContain("Record outcome");
    expect(queries).toContain('where: { purpose: "HR_INTERVIEW", startAt: { gt: new Date() } }');
  });

  it("keeps candidate booking purpose-aware and does not overwrite HR interview state", () => {
    const server = source("src/server/candidate-availability.ts");
    const page = source("src/app/candidate/availability/[requestToken]/page.tsx");

    expect(server).toContain("purpose: request.purpose");
    expect(server).toContain("slot.purpose !== request.purpose");
    expect(server).toContain('request.purpose === "HR_INTERVIEW"');
    expect(server).toContain('status: "INTERVIEW"');
    expect(server).toContain('status: "AVAILABILITY_CONFIRMED"');
    expect(page).toContain("Book your HR interview");
    expect(page).toContain("Confirm HR interview");
    expect(page).toContain("Final-stage conversation");
    expect(page).toContain("Confirmed slot");
    expect(page).toContain("Candidate dashboard");
  });
});
