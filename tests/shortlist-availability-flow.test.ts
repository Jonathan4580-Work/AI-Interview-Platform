import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createAvailabilityRequestToken,
  hashAvailabilityRequestToken,
  parseAvailabilityRequestToken,
  verifyAvailabilityRequestToken,
} from "../src/modules/availability/tokens";
import { normalizeCandidateStatus } from "../src/server/public-careers/candidate-application";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("shortlist and availability confirmation flow", () => {
  it("adds application statuses, decision history, slots, and availability requests", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source(
      "prisma/migrations/20260713100000_shortlist_availability_flow/migration.sql",
    );

    expect(schema).toContain("SHORTLISTED");
    expect(schema).toContain("AVAILABILITY_REQUESTED");
    expect(schema).toContain("AVAILABILITY_CONFIRMED");
    expect(schema).toContain("model ApplicationDecisionHistory");
    expect(schema).toContain("model InterviewAvailabilitySlot");
    expect(schema).toContain("model ApplicationAvailabilityRequest");
    expect(migration).toContain("application_decision_history");
    expect(migration).toContain("interview_availability_slots");
    expect(migration).toContain("application_availability_requests");
  });

  it("creates deterministic signed availability tokens without storing raw tokens", () => {
    const input = {
      requestId: "request_123",
      companyId: "company_123",
      applicationId: "application_123",
      tokenSalt: "salt_123",
    };
    const token = createAvailabilityRequestToken(input);

    expect(token).toMatch(/^av1\.request_123\./u);
    expect(parseAvailabilityRequestToken(token)).toEqual({ requestId: "request_123" });
    expect(
      verifyAvailabilityRequestToken({
        token,
        expectedHash: hashAvailabilityRequestToken(token),
        request: input,
      }),
    ).toBe(true);
    expect(
      verifyAvailabilityRequestToken({
        token,
        expectedHash: hashAvailabilityRequestToken(token),
        request: { ...input, applicationId: "other_application" },
      }),
    ).toBe(false);
  });

  it("wires HR decision and availability actions on the job detail page", () => {
    const page = source("src/app/(workspace)/jobs/[jobId]/page.tsx");
    const actions = source("src/server/hr-workspace/actions.ts");
    const queries = source("src/server/hr-workspace/queries.ts");

    expect(page).toContain("Shortlist");
    expect(page).toContain("Mark as not selected");
    expect(page).toContain("Send availability request");
    expect(page).toContain("Send interview invite");
    expect(page).toContain("Availability slots");
    expect(actions).toContain("shortlistApplicationAction");
    expect(actions).toContain("sendAvailabilityRequestAction");
    expect(actions).toContain("createAvailabilitySlotAction");
    expect(queries).toContain("availabilityRequests");
    expect(queries).toContain("availabilitySlots");
  });

  it("adds candidate availability confirmation and dashboard visibility", () => {
    const page = source("src/app/candidate/availability/[requestToken]/page.tsx");
    const server = source("src/server/candidate-availability.ts");
    const dashboardQueries = source("src/server/public-careers/candidate-queries.ts");
    const dashboardPage = source("src/app/candidate/applications/page.tsx");

    expect(page).toContain("Confirm interview availability");
    expect(page).toContain("confirmCandidateAvailabilityAction");
    expect(server).toContain("verifyAvailabilityRequestToken");
    expect(server).toContain('status: "SELECTED"');
    expect(server).toContain('status: "AVAILABILITY_CONFIRMED"');
    expect(dashboardQueries).toContain("availabilityRequests");
    expect(dashboardPage).toContain("Choose interview time");
  });

  it("maps new application statuses to candidate-facing labels", () => {
    expect(normalizeCandidateStatus("SHORTLISTED")).toBe("Shortlisted");
    expect(normalizeCandidateStatus("AVAILABILITY_REQUESTED")).toBe("Availability Requested");
    expect(normalizeCandidateStatus("AVAILABILITY_CONFIRMED")).toBe("Availability Confirmed");
    expect(normalizeCandidateStatus("NOT_SELECTED")).toBe("Not Selected");
  });

  it("adds the local availability diagnostic script", () => {
    const packageJson = source("package.json");
    const script = source("scripts/local-availability-diagnostic.ts");

    expect(packageJson).toContain("local:availability-diagnostic");
    expect(script).toContain("applicationId");
    expect(script).toContain("availabilityRequests");
    expect(script).toContain("candidateUrl");
  });
});
