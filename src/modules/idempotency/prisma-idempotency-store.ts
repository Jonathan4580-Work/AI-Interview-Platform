import { IdempotencyStatus } from "@prisma/client";

import { prisma } from "@/infra/database";

import { toIdempotencyRecord } from "./mappers";

import type { IdempotencyRecord, IdempotencyStartInput, IdempotencyStore } from "./types";

export class PrismaIdempotencyStore implements IdempotencyStore {
  public async find(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const record = await prisma.idempotencyKey.findUnique({
      where: {
        scope_key: {
          scope,
          key,
        },
      },
    });

    return record === null ? null : toIdempotencyRecord(record);
  }

  public async createProcessing(input: IdempotencyStartInput): Promise<IdempotencyRecord> {
    const record = await prisma.idempotencyKey.create({
      data: {
        companyId: input.companyId,
        key: input.key,
        scope: input.scope,
        requestHash: input.requestHash,
        status: IdempotencyStatus.PROCESSING,
        expiresAt: input.expiresAt,
      },
    });

    return toIdempotencyRecord(record);
  }

  public async markCompleted(scope: string, key: string, responseHash: string): Promise<void> {
    await prisma.idempotencyKey.update({
      where: {
        scope_key: {
          scope,
          key,
        },
      },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseHash,
      },
    });
  }

  public async markFailed(scope: string, key: string): Promise<void> {
    await prisma.idempotencyKey.update({
      where: {
        scope_key: {
          scope,
          key,
        },
      },
      data: {
        status: IdempotencyStatus.FAILED,
      },
    });
  }
}
