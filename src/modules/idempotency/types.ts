import type { TenantId } from "@/modules/tenant";

export const idempotencyStatuses = ["processing", "completed", "failed", "expired"] as const;

export type IdempotencyStatus = (typeof idempotencyStatuses)[number];

export interface IdempotencyRecord {
  readonly id: string;
  readonly companyId: TenantId | null;
  readonly key: string;
  readonly scope: string;
  readonly requestHash: string;
  readonly responseHash: string | null;
  readonly status: IdempotencyStatus;
  readonly expiresAt: Date;
}

export interface IdempotencyStartInput {
  readonly companyId?: TenantId | null;
  readonly key: string;
  readonly scope: string;
  readonly requestHash: string;
  readonly expiresAt: Date;
}

export interface IdempotencyStore {
  find(scope: string, key: string): Promise<IdempotencyRecord | null>;
  createProcessing(input: IdempotencyStartInput): Promise<IdempotencyRecord>;
  markCompleted(scope: string, key: string, responseHash: string): Promise<void>;
  markFailed(scope: string, key: string): Promise<void>;
}
