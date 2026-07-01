import { calculateRetentionDeleteAt } from "@/modules/data-lifecycle";

import { assertSafeEventPayload } from "./safe-payload";

import type {
  CreateOutboxEventInput,
  OutboxEventRecord,
  OutboxEventStore,
  TransactionalOutboxEventStore,
} from "./types";

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
    return this.createEventWithStore(this.store, input);
  }

  public createEventAtomically<TResult>(
    input: CreateOutboxEventInput,
    operation: (store: OutboxEventStore) => Promise<TResult>,
  ): Promise<{ readonly result: TResult; readonly event: OutboxEventRecord }> {
    if (!isTransactionalOutboxStore(this.store)) {
      throw new OutboxDomainError("Outbox store must support transactional event creation.");
    }

    return this.store.transaction(async (transactionStore) => {
      const result = await operation(transactionStore);
      const event = await this.createEventWithStore(transactionStore, input);
      return { result, event };
    });
  }

  private createEventWithStore(
    store: OutboxEventStore,
    input: CreateOutboxEventInput,
  ): Promise<OutboxEventRecord> {
    assertSafeEventPayload(input.payload);
    if (!/^[a-z][a-z0-9_.-]+$/.test(input.eventKey)) {
      throw new OutboxDomainError("Event key must be stable and lowercase.");
    }
    if (!/^v[0-9]+$/.test(input.schemaVersion)) {
      throw new OutboxDomainError("Event schema version must use vN format.");
    }

    const occurredAt = input.occurredAt ?? this.now();
    return store.create({
      ...input,
      occurredAt,
      availableAt: input.availableAt ?? occurredAt,
      payload: input.payload,
    });
  }
}

function isTransactionalOutboxStore(
  store: OutboxEventStore,
): store is TransactionalOutboxEventStore {
  return "transaction" in store && typeof store.transaction === "function";
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
