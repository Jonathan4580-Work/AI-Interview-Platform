import { describe, expect, it } from "vitest";

import {
  DevelopmentAtsAdapter,
  IntegrationMappingError,
  IntegrationSyncError,
  advanceSyncCheckpoint,
  assertSafeIntegrationSyncPayload,
  createInitialSyncCheckpoint,
  createIntegrationMapping,
  resolveIntegrationConflict,
} from "@/modules/integrations";
import { toTenantId } from "@/modules/tenant";

import type { AtsExternalRecord, IntegrationConnectionId } from "@/modules/integrations";

describe("ATS integration foundation", () => {
  it("creates provider-specific mappings outside core domain records", () => {
    const mapping = createIntegrationMapping({
      companyId,
      integrationConnectionId,
      mappingType: "candidate",
      externalId: "greenhouse-candidate-1",
      aptlyResourceType: "candidate",
      aptlyResourceId: "candidate_1",
      conflictPolicy: "manual_review",
    });

    expect(mapping).toMatchObject({
      companyId,
      integrationConnectionId,
      externalId: "greenhouse-candidate-1",
      aptlyResourceType: "candidate",
      aptlyResourceId: "candidate_1",
    });
  });

  it("prevents integrations from overwriting reviewed or immutable records", () => {
    expect(() =>
      createIntegrationMapping({
        companyId,
        integrationConnectionId,
        mappingType: "application",
        externalId: "external-evaluation",
        aptlyResourceType: "evaluation",
        aptlyResourceId: "evaluation_1",
        conflictPolicy: "external_wins",
      }),
    ).toThrow(IntegrationMappingError);
  });

  it("resolves conflict policies without silent overwrites", () => {
    expect(
      resolveIntegrationConflict({
        policy: "aptly_wins",
        aptlyValue: "Aptly",
        externalValue: "ATS",
      }),
    ).toEqual({ resolution: "aptly", value: "Aptly" });
    expect(
      resolveIntegrationConflict({
        policy: "manual_review",
        aptlyValue: "Aptly",
        externalValue: "ATS",
      }),
    ).toEqual({ resolution: "manual_review", value: "Aptly" });
  });

  it("uses deterministic development ATS pagination and sync checkpoints", async () => {
    const adapter = new DevelopmentAtsAdapter([
      record("job-1", "job"),
      record("candidate-1", "candidate"),
      record("application-1", "application"),
    ]);

    const first = await adapter.fetchPage(createInitialSyncCheckpoint());
    const next = advanceSyncCheckpoint({
      checkpoint: createInitialSyncCheckpoint(),
      recordsProcessed: first.records.length,
      nextCursor: first.nextCursor,
      providerRateLimitedUntil: first.rateLimitedUntil,
    });
    const second = await adapter.fetchPage(next);

    expect(first.records.map((item) => item.externalId)).toEqual(["job-1", "candidate-1"]);
    expect(second.records.map((item) => item.externalId)).toEqual(["application-1"]);
    expect(next.recordsProcessed).toBe(2);
  });

  it("keeps integration sync queue payloads ID-only and safe", () => {
    expect(() => {
      assertSafeIntegrationSyncPayload({
        companyId,
        requestId: "req_1",
        correlationId: "corr_1",
        integrationConnectionId,
        syncJobId: "sync_1",
      });
    }).not.toThrow();
    expect(() => {
      assertSafeIntegrationSyncPayload({
        companyId,
        requestId: "req_1",
        correlationId: "corr_1",
        integrationConnectionId: "" as IntegrationConnectionId,
        syncJobId: "sync_1",
      });
    }).toThrow(IntegrationSyncError);
  });
});

const companyId = toTenantId("cats00001");
const integrationConnectionId = "integration_connection_1" as IntegrationConnectionId;

function record(
  externalId: string,
  resourceType: AtsExternalRecord["resourceType"],
): AtsExternalRecord {
  return {
    externalId,
    resourceType,
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    safeFields: {
      status: "active",
    },
  };
}
