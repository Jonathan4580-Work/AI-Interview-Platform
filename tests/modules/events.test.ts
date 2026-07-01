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
  TransactionalOutboxEventStore,
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

  it("rolls back business and outbox writes together when an atomic operation fails", async () => {
    const store = new TransactionalMemoryOutboxStore();
    const service = new OutboxService(store, () => now);

    await expect(
      service.createEventAtomically(
        {
          companyId,
          eventKey: "interview.completed",
          schemaVersion: "v1",
          aggregateType: "interview_session",
          aggregateId: "interview_1",
          payload: { interviewSessionId: "interview_1", status: "completed" },
        },
        async (transactionStore) => {
          await transactionStore.create({
            companyId,
            eventKey: "business.side_effect",
            schemaVersion: "v1",
            aggregateType: "test",
            aggregateId: "business_1",
            occurredAt: now,
            availableAt: now,
            payload: { sideEffectId: "business_1" },
          });
          throw new Error("business failure");
        },
      ),
    ).rejects.toThrow("business failure");

    await expect(
      store.findByAggregate({
        companyId,
        aggregateType: "interview_session",
        aggregateId: "interview_1",
      }),
    ).resolves.toHaveLength(0);
    await expect(
      store.findByAggregate({
        companyId,
        aggregateType: "test",
        aggregateId: "business_1",
      }),
    ).resolves.toHaveLength(0);
  });

  it("preserves aggregate ordering by occurrence timestamp", async () => {
    const store = new MemoryOutboxStore();
    const service = new OutboxService(store, () => now);

    await service.createEvent({
      companyId,
      eventKey: "interview.completed",
      schemaVersion: "v1",
      aggregateType: "interview_session",
      aggregateId: "interview_1",
      occurredAt: new Date("2026-07-01T00:00:02.000Z"),
      payload: { status: "completed" },
    });
    await service.createEvent({
      companyId,
      eventKey: "interview.started",
      schemaVersion: "v1",
      aggregateType: "interview_session",
      aggregateId: "interview_1",
      occurredAt: new Date("2026-07-01T00:00:01.000Z"),
      payload: { status: "started" },
    });

    const events = await store.findByAggregate({
      companyId,
      aggregateType: "interview_session",
      aggregateId: "interview_1",
    });

    expect(events.map((event) => event.eventKey)).toEqual([
      "interview.started",
      "interview.completed",
    ]);
  });
});

const companyId = toTenantId("coutbox001");
const now = new Date("2026-07-01T00:00:00.000Z");

class MemoryOutboxStore implements OutboxEventStore {
  protected events: OutboxEventRecord[] = [];

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
      this.events
        .filter(
          (event) =>
            event.companyId === input.companyId &&
            event.aggregateType === input.aggregateType &&
            event.aggregateId === input.aggregateId,
        )
        .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime()),
    );
  }

  protected cloneEvents(): OutboxEventRecord[] {
    return [...this.events];
  }

  protected replaceEvents(events: readonly OutboxEventRecord[]): void {
    this.events = [...events];
  }
}

class TransactionalMemoryOutboxStore
  extends MemoryOutboxStore
  implements TransactionalOutboxEventStore
{
  public async transaction<T>(operation: (store: OutboxEventStore) => Promise<T>): Promise<T> {
    const snapshot = this.cloneEvents();
    try {
      return await operation(this);
    } catch (error) {
      this.replaceEvents(snapshot);
      throw error;
    }
  }
}
