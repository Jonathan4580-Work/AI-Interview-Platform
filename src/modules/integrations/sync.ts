import { assertSafeQueuePayload } from "@/infra/queue";

import type { IntegrationConnectionId, IntegrationSyncCheckpoint } from "./types";
import type { TenantId } from "@/modules/tenant";

export class IntegrationSyncError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "IntegrationSyncError";
  }
}

export interface IntegrationSyncQueuePayload {
  readonly companyId: TenantId;
  readonly requestId: string;
  readonly correlationId: string;
  readonly integrationConnectionId: IntegrationConnectionId;
  readonly syncJobId: string;
}

export function createInitialSyncCheckpoint(): IntegrationSyncCheckpoint {
  return {
    cursor: {},
    pageNumber: 0,
    recordsProcessed: 0,
    providerRateLimitedUntil: null,
  };
}

export function advanceSyncCheckpoint(input: {
  readonly checkpoint: IntegrationSyncCheckpoint;
  readonly recordsProcessed: number;
  readonly nextCursor: Readonly<Record<string, unknown>> | null;
  readonly providerRateLimitedUntil: Date | null;
}): IntegrationSyncCheckpoint {
  return {
    cursor: input.nextCursor ?? input.checkpoint.cursor,
    pageNumber:
      input.nextCursor === null ? input.checkpoint.pageNumber : input.checkpoint.pageNumber + 1,
    recordsProcessed: input.checkpoint.recordsProcessed + input.recordsProcessed,
    providerRateLimitedUntil: input.providerRateLimitedUntil,
  };
}

export function assertSafeIntegrationSyncPayload(payload: IntegrationSyncQueuePayload): void {
  assertSafeQueuePayload(payload);
  if (
    payload.integrationConnectionId.trim().length === 0 ||
    payload.syncJobId.trim().length === 0
  ) {
    throw new IntegrationSyncError("Integration sync payload requires connection and job IDs.");
  }
}
