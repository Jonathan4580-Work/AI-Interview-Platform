import { describe, expect, it } from "vitest";

import {
  EventPayloadSafetyError,
  OutboxDomainError,
  OutboxService,
  nextOutboxAttemptAt,
} from "@/modules/events";
import { toTenantId } from "@/modules/tenant";

import type {
  CreateOutboxEventInput,
  OutboxEventId,
  OutboxEventRecord,
  OutboxEventStore,
} from "@/modules/events";

describe("transactional event outbox foundation", () => {
  it("creates safe tenant-scoped outbox events with request context", async () => {
    const store = new MemoryOutboxStore();
    const service = new OutboxService(store, () => now);

    const event = await service.createEvent({
      companyId,
      eventKey: "interview.completed",
      schemaVersion: "v1",
      aggregateType: "interview_session",
      aggregateId: "interview_1",
      requestId: "req_1",
      correlationId: "corr_1",
      payload: {
        interviewSessionId: "interview_1",
        status: "completed",
      },
    });

    expect(event).toMatchObject({
      companyId,
      eventKey: "interview.completed",
      schemaVersion: "v1",
      aggregateType: "interview_session",
      aggregateId: "interview_1",
      requestId: "req_1",
      correlationId: "corr_1",
      status: "pending",
    });
  });

  it("rejects unsafe payloads and unstable event metadata", () => {
    const service = new OutboxService(new MemoryOutboxStore(), () => now);

    expect(() => {
      void service.createEvent({
        companyId,
        eventKey: "interview.completed",
        schemaVersion: "v1",
        aggregateType: "interview_session",
        aggregateId: "interview_1",
        payload: {
          transcriptText: "restricted candidate answer text",
        },
      });
    }).toThrow(EventPayloadSafetyError);

    expect(() => {
      void service.createEvent({
        companyId,
        eventKey: "Interview Completed",
        schemaVersion: "1",
        aggregateType: "interview_session",
        aggregateId: "interview_1",
        payload: { status: "completed" },
      });
    }).toThrow(OutboxDomainError);
  });

  it("computes bounded retry backoff for idempotent delivery", () => {
    expect(nextOutboxAttemptAt({ attemptCount: 0, now }).toISOString()).toBe(
      "2026-07-01T00:00:01.000Z",
    );
    expect(nextOutboxAttemptAt({ attemptCount: 3, now }).toISOString()).toBe(
      "2026-07-01T00:00:08.000Z",
    );
  });
});

const companyId = toTenantId("coutbox001");
const now = new Date("2026-07-01T00:00:00.000Z");

class MemoryOutboxStore implements OutboxEventStore {
  private readonly events: OutboxEventRecord[] = [];

  public create(
    input: CreateOutboxEventInput & { readonly occurredAt: Date; readonly availableAt: Date },
  ): Promise<OutboxEventRecord> {
    const event: OutboxEventRecord = {
      id: `outbox_${String(this.events.length + 1)}` as OutboxEventId,
      companyId: input.companyId,
      eventKey: input.eventKey,
      schemaVersion: input.schemaVersion,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      occurredAt: input.occurredAt,
      availableAt: input.availableAt,
      status: "pending",
      attemptCount: 0,
      requestId: input.requestId ?? null,
      correlationId: input.correlationId ?? null,
      payload: input.payload,
    };
    this.events.push(event);
    return Promise.resolve(event);
  }

  public findByAggregate(input: {
    readonly companyId: typeof companyId;
    readonly aggregateType: string;
    readonly aggregateId: string;
  }): Promise<readonly OutboxEventRecord[]> {
    return Promise.resolve(
      this.events.filter(
        (event) =>
          event.companyId === input.companyId &&
          event.aggregateType === input.aggregateType &&
          event.aggregateId === input.aggregateId,
      ),
    );
  }
}
