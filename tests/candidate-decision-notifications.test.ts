import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("candidate decision notifications", () => {
  it("adds a safe application decision notification intent type", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source(
      "prisma/migrations/20260714100000_candidate_decision_notifications/migration.sql",
    );
    const types = source("src/modules/notifications/types.ts");

    expect(schema).toContain("APPLICATION_DECISION");
    expect(migration).toContain("MODIFY COLUMN `type` ENUM");
    expect(migration).toContain("'APPLICATION_DECISION'");
    expect(types).toContain('"application_decision"');
  });

  it("queues candidate decision notifications without leaking HR notes", () => {
    const actions = source("src/server/hr-workspace/actions.ts");

    expect(actions).toContain("createCandidateDecisionNotificationIntent");
    expect(actions).toContain('type: "APPLICATION_DECISION"');
    expect(actions).toContain('targetResourceType: "candidate_application"');
    expect(actions).toContain('status: { in: ["PENDING", "DISPATCHED"] }');
    expect(actions).toContain("onboardingDate: input.onboardingDate");
    expect(actions).not.toContain("payloadJson: note");
    expect(actions).not.toContain("outcomeNote:");
  });

  it("shows final candidate outcomes without exposing internal review notes", () => {
    const queries = source("src/server/public-careers/candidate-queries.ts");
    const page = source("src/app/candidate/applications/page.tsx");

    expect(queries).toContain("readFinalOutcome");
    expect(queries).toContain('decision: "HIRED" | "REJECTED"');
    expect(page).toContain("Offer outcome recorded");
    expect(page).toContain("Application review completed");
    expect(page).toContain("Target onboarding date");
    expect(page).not.toContain("outcomeNote");
  });
});
