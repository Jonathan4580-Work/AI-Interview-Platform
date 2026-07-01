import { describe, expect, it } from "vitest";

import { hashIdempotencyPayload, IdempotencyService } from "@/modules/idempotency";

import type {
  IdempotencyRecord,
  IdempotencyStartInput,
  IdempotencyStore,
} from "@/modules/idempotency";

class RecordingIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  public find(scope: string, key: string): Promise<IdempotencyRecord | null> {
    return Promise.resolve(this.records.get(`${scope}:${key}`) ?? null);
  }

  public createProcessing(input: IdempotencyStartInput): Promise<IdempotencyRecord> {
    const record: IdempotencyRecord = {
      id: `${input.scope}:${input.key}`,
      companyId: input.companyId ?? null,
      key: input.key,
      scope: input.scope,
      requestHash: input.requestHash,
      responseHash: null,
      status: "processing",
      expiresAt: input.expiresAt,
    };

    this.records.set(`${input.scope}:${input.key}`, record);
    return Promise.resolve(record);
  }

  public markCompleted(scope: string, key: string, responseHash: string): Promise<void> {
    const existing = this.records.get(`${scope}:${key}`);

    if (existing !== undefined) {
      this.records.set(`${scope}:${key}`, {
        ...existing,
        responseHash,
        status: "completed",
      });
    }

    return Promise.resolve();
  }

  public markFailed(scope: string, key: string): Promise<void> {
    const existing = this.records.get(`${scope}:${key}`);

    if (existing !== undefined) {
      this.records.set(`${scope}:${key}`, {
        ...existing,
        status: "failed",
      });
    }

    return Promise.resolve();
  }
}

describe("idempotency module", () => {
  it("hashes equivalent payloads consistently", () => {
    expect(hashIdempotencyPayload({ b: 2, a: 1 })).toBe(hashIdempotencyPayload({ a: 1, b: 2 }));
  });

  it("returns existing records for matching replayed payloads", async () => {
    const service = new IdempotencyService(new RecordingIdempotencyStore());
    const expiresAt = new Date("2099-07-01T00:00:00.000Z");

    const first = await service.begin({
      key: "key-1",
      scope: "test",
      payload: { a: 1 },
      expiresAt,
    });
    const second = await service.begin({
      key: "key-1",
      scope: "test",
      payload: { a: 1 },
      expiresAt,
    });

    expect(second).toEqual(first);
  });

  it("rejects idempotency key reuse with different payloads", async () => {
    const service = new IdempotencyService(new RecordingIdempotencyStore());
    const expiresAt = new Date("2099-07-01T00:00:00.000Z");

    await service.begin({
      key: "key-1",
      scope: "test",
      payload: { a: 1 },
      expiresAt,
    });

    await expect(
      service.begin({
        key: "key-1",
        scope: "test",
        payload: { a: 2 },
        expiresAt,
      }),
    ).rejects.toThrow("Idempotency key reused with a different request payload.");
  });

  it("rejects replay after idempotency key expiration", async () => {
    const service = new IdempotencyService(new RecordingIdempotencyStore());

    await service.begin({
      key: "key-1",
      scope: "test",
      payload: { a: 1 },
      expiresAt: new Date("2000-01-01T00:00:00.000Z"),
    });

    await expect(
      service.begin({
        key: "key-1",
        scope: "test",
        payload: { a: 1 },
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow("Idempotency key has expired.");
  });
});
