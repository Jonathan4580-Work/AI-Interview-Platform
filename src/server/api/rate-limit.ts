import { createHash } from "node:crypto";

import { rateLimited } from "./errors";

export interface RateLimitRule {
  readonly windowMs: number;
  readonly max: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
}

export interface RateLimiter {
  check(key: string, rule: RateLimitRule, now?: Date): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
  lastSeenAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly maxBuckets: number;
  private readonly buckets = new Map<string, Bucket>();

  public constructor(options: { readonly maxBuckets?: number } = {}) {
    this.maxBuckets = options.maxBuckets ?? 10_000;
  }

  public check(key: string, rule: RateLimitRule, now = new Date()): Promise<RateLimitResult> {
    const currentTime = now.getTime();
    this.pruneExpiredBuckets(currentTime);
    this.pruneToCapacity();
    const bucket = this.buckets.get(key);

    if (bucket === undefined || bucket.resetAt <= currentTime) {
      const resetAt = currentTime + rule.windowMs;
      this.buckets.set(key, { count: 1, resetAt, lastSeenAt: currentTime });
      return Promise.resolve({
        allowed: true,
        remaining: rule.max - 1,
        resetAt: new Date(resetAt),
      });
    }

    bucket.count += 1;
    bucket.lastSeenAt = currentTime;
    return Promise.resolve({
      allowed: bucket.count <= rule.max,
      remaining: Math.max(rule.max - bucket.count, 0),
      resetAt: new Date(bucket.resetAt),
    });
  }

  private pruneExpiredBuckets(currentTime: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= currentTime) {
        this.buckets.delete(key);
      }
    }
  }

  private pruneToCapacity(): void {
    if (this.buckets.size < this.maxBuckets) {
      return;
    }

    const bucketsByAge = [...this.buckets.entries()].sort(
      ([, left], [, right]) => left.lastSeenAt - right.lastSeenAt,
    );
    const bucketsToDelete = Math.max(1, this.buckets.size - this.maxBuckets + 1);
    for (const [key] of bucketsByAge.slice(0, bucketsToDelete)) {
      this.buckets.delete(key);
    }
  }
}

export async function enforceRateLimit(input: {
  readonly limiter: RateLimiter;
  readonly key: string;
  readonly rule: RateLimitRule;
  readonly now?: Date;
}): Promise<RateLimitResult> {
  const result = await input.limiter.check(input.key, input.rule, input.now);
  if (!result.allowed) {
    throw rateLimited();
  }
  return result;
}

export function rateLimitKey(parts: readonly (string | null | undefined)[]): string {
  return parts
    .map((part) => {
      const trimmed = part?.trim();
      if (trimmed === undefined || trimmed.length === 0) {
        return "unknown";
      }
      return trimmed.length > 128
        ? `sha256:${createHash("sha256").update(trimmed).digest("hex")}`
        : trimmed;
    })
    .join(":");
}
