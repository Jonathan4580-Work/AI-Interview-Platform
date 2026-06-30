import { calculateRetentionDeleteAt } from "@/modules/data-lifecycle";

import { assertSafeEventPayload } from "./safe-payload";

import type { CreateOutboxEventInput, OutboxEventRecord, OutboxEventStore } from "./types";

export class OutboxDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "OutboxDomainError";
  }
}

export class OutboxService {
  public constructor(
    private readonly store: OutboxEventStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public createEvent(input: CreateOutboxEventInput): Promise<OutboxEventRecord> {
    assertSafeEventPayload(input.payload);
    if (!/^[a-z][a-z0-9_.-]+$/.test(input.eventKey)) {
      throw new OutboxDomainError("Event key must be stable and lowercase.");
    }
    if (!/^v[0-9]+$/.test(input.schemaVersion)) {
      throw new OutboxDomainError("Event schema version must use vN format.");
    }

    const occurredAt = input.occurredAt ?? this.now();
    return this.store.create({
      ...input,
      occurredAt,
      availableAt: input.availableAt ?? occurredAt,
      payload: input.payload,
    });
  }
}

export function nextOutboxAttemptAt(input: {
  readonly attemptCount: number;
  readonly now?: Date;
}): Date {
  const now = input.now ?? new Date();
  const boundedAttempt = Math.min(Math.max(input.attemptCount, 0), 10);
  return new Date(now.getTime() + 2 ** boundedAttempt * 1_000);
}

export function outboxRetentionDeleteAt(anchor: Date): Date {
  return calculateRetentionDeleteAt(anchor, 90);
}
