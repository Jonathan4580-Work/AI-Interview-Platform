import { IdempotencyStatus as PrismaIdempotencyStatus } from "@prisma/client";

import type { IdempotencyRecord, IdempotencyStatus } from "./types";
import type { TenantId } from "@/modules/tenant";
import type { IdempotencyKey } from "@prisma/client";

export function mapIdempotencyStatus(status: PrismaIdempotencyStatus): IdempotencyStatus {
  switch (status) {
    case PrismaIdempotencyStatus.PROCESSING:
      return "processing";
    case PrismaIdempotencyStatus.COMPLETED:
      return "completed";
    case PrismaIdempotencyStatus.FAILED:
      return "failed";
    case PrismaIdempotencyStatus.EXPIRED:
      return "expired";
  }
}

export function toIdempotencyRecord(record: IdempotencyKey): IdempotencyRecord {
  return {
    id: record.id,
    companyId: record.companyId as TenantId | null,
    key: record.key,
    scope: record.scope,
    requestHash: record.requestHash,
    responseHash: record.responseHash,
    status: mapIdempotencyStatus(record.status),
    expiresAt: record.expiresAt,
  };
}
