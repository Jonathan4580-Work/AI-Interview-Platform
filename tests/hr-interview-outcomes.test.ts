import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("HR interview outcomes", () => {
  it("extends decision history for human-owned hire and rejection outcomes", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source(
      "prisma/migrations/20260714090000_hr_interview_outcomes/migration.sql",
    );

    expect(schema).toContain("HIRED");
    expect(schema).toContain("REJECTED");
    expect(migration).toContain("MODIFY COLUMN `decision` ENUM");
    expect(migration).toContain("'HIRED'");
    expect(migration).toContain("'REJECTED'");
  });

  it("records final HR interview outcomes without relying on AI status mutation", () => {
    const actions = source("src/server/hr-workspace/actions.ts");

    expect(actions).toContain("recordHrInterviewOutcomeAction");
    expect(actions).toContain("application.hr_interview_outcome_recorded");
    expect(actions).toContain('outcome", ["HIRE", "REJECT", "HOLD"]');
    expect(actions).toContain('return "HIRED"');
    expect(actions).toContain('return "REJECTED"');
    expect(actions).toContain("isHrOutcomeAllowed");
    expect(actions).toContain("hrInterviewOutcome");
    expect(actions).toContain("noteAdded: true");
    expect(actions).not.toContain("monitoringEvents.update");
    expect(actions).not.toContain("evaluationVersions.update");
  });

  it("surfaces a clear HR result panel on the verification workspace", () => {
    const page = source("src/app/(workspace)/applications/[applicationId]/verification/page.tsx");

    expect(page).toContain("HR interview result");
    expect(page).toContain("Hire candidate");
    expect(page).toContain("Not selected");
    expect(page).toContain("Keep in interview");
    expect(page).toContain("AI scores and");
    expect(page).toContain("monitoring warnings do not make hiring decisions");
  });
});
