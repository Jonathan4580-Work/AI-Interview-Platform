import { describe, expect, it } from "vitest";

import { createPermissionSet } from "@/modules/access-control";
import {
  WorkspaceSearchService,
  type SearchCursor,
  type SearchResult,
  type WorkspaceSearchProvider,
} from "@/modules/search";
import { toTenantId } from "@/modules/tenant";

describe("WorkspaceSearchService", () => {
  const tenant = { companyId: toTenantId("company001") };

  it("requires workspace search and underlying category permissions", async () => {
    const provider = new CapturingSearchProvider([]);
    const service = new WorkspaceSearchService(provider);

    const withoutWorkspace = await service.search(
      { tenant, permissionSet: createPermissionSet(["candidates:read"]) },
      { query: "Ada" },
    );

    expect(withoutWorkspace.results).toHaveLength(0);
    expect(provider.calls).toHaveLength(0);

    await service.search(
      { tenant, permissionSet: createPermissionSet(["search:workspace", "candidates:read"]) },
      { query: "Ada", categories: ["candidate", "job"] },
    );

    expect(provider.calls[0]?.categories).toEqual(["candidate"]);
  });

  it("uses deterministic cursor pagination without duplicate records", async () => {
    const records = [
      result({
        id: "candidate_1",
        title: "Ada Lovelace",
        score: 200,
        updatedAt: "2026-01-03T00:00:00.000Z",
      }),
      result({
        id: "candidate_2",
        title: "Ada Byron",
        score: 200,
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
      result({
        id: "job_1",
        category: "job",
        title: "Backend Engineer",
        score: 100,
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const provider = new CapturingSearchProvider(records);
    const service = new WorkspaceSearchService(provider);
    const scope = {
      tenant,
      permissionSet: createPermissionSet(["search:workspace", "candidates:read", "jobs:read"]),
    };

    const first = await service.search(scope, { query: "Ada", limit: 2 });
    const second = await service.search(scope, {
      query: "Ada",
      limit: 2,
      cursor: first.nextCursor,
    });

    expect(first.results.map((record) => record.id)).toEqual(["candidate_1", "candidate_2"]);
    expect(second.results.map((record) => record.id)).toEqual(["job_1"]);
  });

  it("does not request protected categories unless explicitly permissioned", async () => {
    const provider = new CapturingSearchProvider([]);
    const service = new WorkspaceSearchService(provider);

    await service.search(
      { tenant, permissionSet: createPermissionSet(["search:workspace", "jobs:read"]) },
      { query: "secret transcript body", categories: ["candidate", "job", "report"] },
    );

    expect(provider.calls[0]?.categories).toEqual(["job"]);
  });

  it("normalizes and bounds query and page size", async () => {
    const provider = new CapturingSearchProvider([]);
    const service = new WorkspaceSearchService(provider);

    await service.search(
      { tenant, permissionSet: createPermissionSet(["search:workspace", "candidates:read"]) },
      { query: `  ${"Ada ".repeat(80)}  `, limit: 500 },
    );

    expect(provider.calls[0]?.query.length).toBeLessThanOrEqual(120);
    expect(provider.calls[0]?.limit).toBe(51);
  });
});

class CapturingSearchProvider implements WorkspaceSearchProvider {
  public readonly calls: {
    readonly query: string;
    readonly categories: readonly string[];
    readonly limit: number;
    readonly cursor: SearchCursor | null;
  }[] = [];

  public constructor(private readonly records: readonly SearchResult[]) {}

  public search(
    input: Parameters<WorkspaceSearchProvider["search"]>[0],
  ): Promise<readonly SearchResult[]> {
    this.calls.push({
      query: input.query,
      categories: input.categories,
      limit: input.limit,
      cursor: input.cursor,
    });

    if (input.cursor === null) {
      return Promise.resolve(this.records.slice(0, input.limit));
    }

    return Promise.resolve(
      this.records.filter((record) => record.id !== "candidate_1" && record.id !== "candidate_2"),
    );
  }
}

function result(overrides: {
  readonly id: string;
  readonly title: string;
  readonly score: number;
  readonly updatedAt: string;
  readonly category?: SearchResult["category"];
}): SearchResult {
  return {
    id: overrides.id,
    category: overrides.category ?? "candidate",
    title: overrides.title,
    subtitle: null,
    href: `/workspace/${overrides.id}`,
    score: overrides.score,
    matchedFields: ["candidate_name"],
    updatedAt: new Date(overrides.updatedAt),
    metadata: {},
  };
}
