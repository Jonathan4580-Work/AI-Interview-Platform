import { describe, expect, it } from "vitest";

import {
  AnalyticsDomainError,
  AnalyticsService,
  type AnalyticsEventRecord,
  type AnalyticsEventStore,
} from "@/modules/reporting";
import { toTenantId } from "@/modules/tenant";

describe("AnalyticsService", () => {
  const tenant = { companyId: toTenantId("company001") };

  it("records only allowlisted analytics properties", async () => {
    const store = new InMemoryAnalyticsEventStore();
    const service = new AnalyticsService(store);

    const event = await service.record({
      tenant,
      eventKey: "interview.completed",
      subjectType: "interview_session",
      subjectId: "interview_1",
      idempotencyKey: "analytics-key-1",
      properties: { interviewSessionId: "interview_1", durationSeconds: 3600 },
    });

    expect(event.schemaVersion).toBe("analytics.v1");
    expect(event.properties).toEqual({ interviewSessionId: "interview_1", durationSeconds: 3600 });
  });

  it("rejects arbitrary metadata and restricted body-like values", async () => {
    const service = new AnalyticsService(new InMemoryAnalyticsEventStore());

    await expect(
      service.record({
        tenant,
        eventKey: "evaluation.completed",
        subjectType: "evaluation",
        subjectId: "evaluation_1",
        idempotencyKey: "analytics-key-2",
        properties: {
          evaluationId: "evaluation_1",
          confidence: "high",
          transcriptBody: "This must not enter analytics.",
        },
      }),
    ).rejects.toThrow(AnalyticsDomainError);
  });

  it("returns the existing event for a duplicate idempotency key", async () => {
    const store = new InMemoryAnalyticsEventStore();
    const service = new AnalyticsService(store);
    const input = {
      tenant,
      eventKey: "email.delivered" as const,
      subjectType: "email_delivery" as const,
      subjectId: "delivery_1",
      idempotencyKey: "analytics-key-3",
      properties: { deliveryId: "delivery_1" },
    };

    const first = await service.record(input);
    const second = await service.record(input);

    expect(first.id).toBe(second.id);
    expect(store.records).toHaveLength(1);
  });

  it("scopes idempotency to the tenant", async () => {
    const store = new InMemoryAnalyticsEventStore();
    const service = new AnalyticsService(store);

    await service.record({
      tenant,
      eventKey: "candidate.created",
      subjectType: "candidate",
      subjectId: "candidate_1",
      idempotencyKey: "analytics-key-4",
      properties: { sourceType: "manual" },
    });
    await service.record({
      tenant: { companyId: toTenantId("company002") },
      eventKey: "candidate.created",
      subjectType: "candidate",
      subjectId: "candidate_1",
      idempotencyKey: "analytics-key-4",
      properties: { sourceType: "manual" },
    });

    expect(store.records).toHaveLength(2);
  });
});

class InMemoryAnalyticsEventStore implements AnalyticsEventStore {
  public readonly records: AnalyticsEventRecord[] = [];

  public findByIdempotencyKey(
    input: Parameters<AnalyticsEventStore["findByIdempotencyKey"]>[0],
  ): Promise<AnalyticsEventRecord | null> {
    return Promise.resolve(
      this.records.find(
        (record) =>
          record.companyId === input.companyId && record.idempotencyKey === input.idempotencyKey,
      ) ?? null,
    );
  }

  public create(
    input: Parameters<AnalyticsEventStore["create"]>[0],
  ): Promise<AnalyticsEventRecord> {
    const record: AnalyticsEventRecord = {
      id: `analytics_${String(this.records.length + 1)}` as AnalyticsEventRecord["id"],
      companyId: input.companyId,
      eventKey: input.eventKey,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      idempotencyKey: input.idempotencyKey,
      schemaVersion: input.schemaVersion,
      occurredAt: input.occurredAt,
      properties: input.properties,
      createdAt: new Date(),
    };
    this.records.push(record);
    return Promise.resolve(record);
  }
}
