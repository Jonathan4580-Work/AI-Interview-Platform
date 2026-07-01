import type { TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type OutboxEventId = Brand<string, "OutboxEventId">;

export const outboxEventStatuses = [
  "pending",
  "processing",
  "delivered",
  "retry_scheduled",
  "dead_lettered",
  "cancelled",
] as const;

export type OutboxEventStatus = (typeof outboxEventStatuses)[number];

export interface OutboxEventRecord {
  readonly id: OutboxEventId;
  readonly companyId: TenantId;
  readonly eventKey: string;
  readonly schemaVersion: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly availableAt: Date;
  readonly status: OutboxEventStatus;
  readonly attemptCount: number;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface CreateOutboxEventInput {
  readonly companyId: TenantId;
  readonly eventKey: string;
  readonly schemaVersion: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly occurredAt?: Date;
  readonly availableAt?: Date;
  readonly requestId?: string | null;
  readonly correlationId?: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface OutboxEventStore {
  create(
    input: CreateOutboxEventInput & { readonly occurredAt: Date; readonly availableAt: Date },
  ): Promise<OutboxEventRecord>;
  findByAggregate(input: {
    readonly companyId: TenantId;
    readonly aggregateType: string;
    readonly aggregateId: string;
  }): Promise<readonly OutboxEventRecord[]>;
}

export interface TransactionalOutboxEventStore extends OutboxEventStore {
  transaction<T>(operation: (store: OutboxEventStore) => Promise<T>): Promise<T>;
}
