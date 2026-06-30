import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createPermissionSet } from "@/modules/access-control";
import { AggregateReportService } from "@/modules/reporting";
import { WorkspaceSearchService, type WorkspaceSearchProvider } from "@/modules/search";
import { toTenantId } from "@/modules/tenant";
import { MemoryRateLimiter, enforceRateLimit, rateLimitKey } from "@/server/api";

import type { AggregateReportStore, AggregateSourceEvent } from "@/modules/reporting";
import type { SearchResult } from "@/modules/search";

describe("Phase 11 performance boundaries", () => {
  const tenant = { companyId: toTenantId("cperformancecompany") };

  it("keeps public rate-limit state bounded under many unique keys", async () => {
    const limiter = new MemoryRateLimiter({ maxBuckets: 25 });
    const now = new Date("2026-07-01T00:00:00.000Z");

    for (let index = 0; index < 100; index += 1) {
      await enforceRateLimit({
        limiter,
        key: rateLimitKey(["token_exchange", `203.0.113.${String(index)}`]),
        rule: { windowMs: 60_000, max: 10 },
        now,
      });
    }

    await expect(
      enforceRateLimit({
        limiter,
        key: rateLimitKey(["token_exchange", "203.0.113.1"]),
        rule: { windowMs: 60_000, max: 1 },
        now,
      }),
    ).resolves.toBeDefined();
  });

  it("documents production-pilot performance thresholds and accepted load limits", () => {
    const report = readFileSync(
      join(process.cwd(), "docs", "PERFORMANCE_LOAD_TEST_REPORT.md"),
      "utf8",
    );

    expect(report).toContain("Search: deterministic cursor pagination");
    expect(report).toContain("Reports: maximum date range");
    expect(report).toContain("In-memory rate limiting is acceptable");
    expect(report).toContain("Query-plan verification");
  });

  it("keeps search and aggregate reports bounded at service boundaries", async () => {
    const searchProvider = new CapturingSearchProvider([]);
    const search = await new WorkspaceSearchService(searchProvider).search(
      {
        tenant,
        permissionSet: createPermissionSet(["search:workspace", "jobs:read"]),
      },
      { query: "Backend ".repeat(100), categories: ["job"], limit: 500 },
    );

    expect(search.results).toEqual([]);
    expect(searchProvider.lastLimit).toBe(51);
    expect(searchProvider.lastQuery.length).toBeLessThanOrEqual(120);

    await expect(
      new AggregateReportService(new EmptyAggregateStore()).generate({
        tenant,
        reportType: "interview_completion",
        dateRangeStart: new Date("2024-01-01T00:00:00.000Z"),
        dateRangeEnd: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow("Aggregate report date range");
  });
});

class CapturingSearchProvider implements WorkspaceSearchProvider {
  public lastLimit = 0;
  public lastQuery = "";

  public constructor(private readonly results: readonly SearchResult[]) {}

  public search(input: Parameters<WorkspaceSearchProvider["search"]>[0]) {
    this.lastLimit = input.limit;
    this.lastQuery = input.query;
    return Promise.resolve(this.results);
  }
}

class EmptyAggregateStore implements AggregateReportStore {
  public findRunByIdempotencyKey(): Promise<null> {
    return Promise.resolve(null);
  }

  public createRun(): never {
    throw new Error("Report should be rejected before creating a run.");
  }

  public markReady(): never {
    throw new Error("Report should be rejected before completion.");
  }

  public listEvents(): Promise<readonly AggregateSourceEvent[]> {
    return Promise.resolve([]);
  }
}
