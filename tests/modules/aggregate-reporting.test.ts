import { describe, expect, it } from "vitest";

import {
  AggregateReportDomainError,
  AggregateReportService,
  type AggregateReportRunId,
  type AggregateReportRunRecord,
  type AggregateReportStore,
  type AggregateSourceEvent,
} from "@/modules/reporting";
import { toTenantId } from "@/modules/tenant";

describe("AggregateReportService", () => {
  const tenant = { companyId: toTenantId("company001") };
  const start = new Date("2026-01-01T00:00:00.000Z");
  const end = new Date("2026-01-31T00:00:00.000Z");

  it("generates bounded descriptive reports from allowlisted analytics events", async () => {
    const store = new InMemoryAggregateReportStore([
      event("interview.started", "interview_session", "interview_1"),
      event("interview.completed", "interview_session", "interview_1"),
      event("interview.interrupted", "interview_session", "interview_2"),
    ]);
    const service = new AggregateReportService(store, () => new Date("2026-02-01T00:00:00.000Z"));

    const run = await service.generate({
      tenant,
      reportType: "interview_completion",
      dateRangeStart: start,
      dateRangeEnd: end,
      idempotencyKey: "aggregate-key-1",
    });

    expect(run.status).toBe("ready");
    expect(run.result?.totals).toEqual({
      "interview.started": 1,
      "interview.completed": 1,
      "interview.interrupted": 1,
    });
    expect(run.result?.limitations.join(" ")).toContain("automated hiring decisions");
  });

  it("rejects unbounded date ranges and excessive dimensions", async () => {
    const service = new AggregateReportService(new InMemoryAggregateReportStore([]));

    await expect(
      service.generate({
        tenant,
        reportType: "interview_completion",
        dateRangeStart: new Date("2024-01-01T00:00:00.000Z"),
        dateRangeEnd: new Date("2026-01-31T00:00:00.000Z"),
      }),
    ).rejects.toThrow(AggregateReportDomainError);

    await expect(
      service.generate({
        tenant,
        reportType: "interview_completion",
        dateRangeStart: start,
        dateRangeEnd: end,
        dimensions: { groupBy: ["eventKey", "status", "confidence", "warningType", "severity"] },
      }),
    ).rejects.toThrow(AggregateReportDomainError);
  });

  it("returns an existing run for a duplicate idempotency key", async () => {
    const store = new InMemoryAggregateReportStore([
      event("email.delivered", "email_delivery", "delivery_1"),
    ]);
    const service = new AggregateReportService(store);
    const input = {
      tenant,
      reportType: "email_deliverability" as const,
      dateRangeStart: start,
      dateRangeEnd: end,
      idempotencyKey: "aggregate-key-2",
    };

    const first = await service.generate(input);
    const second = await service.generate(input);

    expect(first.id).toBe(second.id);
    expect(store.runs).toHaveLength(1);
  });

  it("keeps monitoring warning summaries separate from score calculations", async () => {
    const store = new InMemoryAggregateReportStore([
      event("monitoring.warning_aggregated", "interview_session", "interview_1", {
        warningType: "looking_away",
        severity: "low",
        count: 2,
      }),
    ]);
    const service = new AggregateReportService(store);

    const run = await service.generate({
      tenant,
      reportType: "monitoring_warning_frequency",
      dateRangeStart: start,
      dateRangeEnd: end,
    });

    expect(run.result?.rows).toEqual([{ warningType: "looking_away", severity: "low", count: 1 }]);
    expect(JSON.stringify(run.result?.rows)).not.toContain("score");
  });
});

class InMemoryAggregateReportStore implements AggregateReportStore {
  public readonly runs: AggregateReportRunRecord[] = [];

  public constructor(private readonly events: readonly AggregateSourceEvent[]) {}

  public findRunByIdempotencyKey(
    input: Parameters<AggregateReportStore["findRunByIdempotencyKey"]>[0],
  ): Promise<AggregateReportRunRecord | null> {
    return Promise.resolve(
      this.runs.find(
        (run) => run.companyId === input.companyId && run.idempotencyKey === input.idempotencyKey,
      ) ?? null,
    );
  }

  public createRun(
    input: Parameters<AggregateReportStore["createRun"]>[0],
  ): Promise<AggregateReportRunRecord> {
    const run: AggregateReportRunRecord = {
      id: `aggregate_${String(this.runs.length + 1)}` as AggregateReportRunId,
      companyId: input.companyId,
      requestedByUserId: input.requestedByUserId,
      reportType: input.reportType,
      status: "requested",
      idempotencyKey: input.idempotencyKey,
      dateRangeStart: input.dateRangeStart,
      dateRangeEnd: input.dateRangeEnd,
      filters: input.filters,
      dimensions: input.dimensions,
      result: null,
      rowCount: null,
      generatedAt: null,
      expiresAt: input.expiresAt,
      failureReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.runs.push(run);
    return Promise.resolve(run);
  }

  public markReady(
    input: Parameters<AggregateReportStore["markReady"]>[0],
  ): Promise<AggregateReportRunRecord> {
    const index = this.runs.findIndex(
      (run) => run.companyId === input.companyId && run.id === input.runId,
    );
    if (index < 0) {
      throw new Error("Missing run.");
    }
    const current = this.runs[index];
    const updated = {
      ...current,
      status: "ready" as const,
      result: input.result,
      rowCount: input.rowCount,
      generatedAt: input.generatedAt,
      updatedAt: input.generatedAt,
    };
    this.runs[index] = updated;
    return Promise.resolve(updated);
  }

  public listEvents(
    input: Parameters<AggregateReportStore["listEvents"]>[0],
  ): Promise<readonly AggregateSourceEvent[]> {
    return Promise.resolve(
      this.events
        .filter((record) => input.eventKeys.includes(record.eventKey))
        .filter(
          (record) =>
            record.occurredAt >= input.dateRangeStart && record.occurredAt < input.dateRangeEnd,
        )
        .slice(0, input.limit),
    );
  }
}

function event(
  eventKey: AggregateSourceEvent["eventKey"],
  subjectType: string,
  subjectId: string,
  properties: AggregateSourceEvent["properties"] = {},
): AggregateSourceEvent {
  return {
    eventKey,
    subjectType,
    subjectId,
    occurredAt: new Date("2026-01-10T00:00:00.000Z"),
    properties,
  };
}
