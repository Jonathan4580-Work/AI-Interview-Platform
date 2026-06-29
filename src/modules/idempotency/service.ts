import { hashIdempotencyPayload } from "./hash";

import type { IdempotencyRecord, IdempotencyStore } from "./types";
import type { TenantId } from "@/modules/tenant";

export class IdempotencyService {
  public constructor(private readonly store: IdempotencyStore) {}

  public async begin(input: {
    readonly companyId?: TenantId | null;
    readonly key: string;
    readonly scope: string;
    readonly payload: unknown;
    readonly expiresAt: Date;
  }): Promise<IdempotencyRecord> {
    const requestHash = hashIdempotencyPayload(input.payload);
    const existing = await this.store.find(input.scope, input.key);

    if (existing !== null) {
      if (existing.requestHash !== requestHash) {
        throw new Error("Idempotency key reused with a different request payload.");
      }

      return existing;
    }

    return this.store.createProcessing({
      companyId: input.companyId ?? null,
      key: input.key,
      scope: input.scope,
      requestHash,
      expiresAt: input.expiresAt,
    });
  }

  public async complete(scope: string, key: string, responsePayload: unknown): Promise<void> {
    await this.store.markCompleted(scope, key, hashIdempotencyPayload(responsePayload));
  }

  public async fail(scope: string, key: string): Promise<void> {
    await this.store.markFailed(scope, key);
  }
}
