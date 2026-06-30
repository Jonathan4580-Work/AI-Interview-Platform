import { hasPermission } from "@/modules/access-control";

import { compareSearchResults, createSearchCursor, parseSearchCursor } from "./cursor";
import {
  searchCategories,
  type SearchCategory,
  type SearchQuery,
  type SearchResultPage,
  type SearchScope,
  type WorkspaceSearchProvider,
} from "./types";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 120;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CATEGORY_PERMISSION: Record<SearchCategory, Parameters<typeof hasPermission>[1]> = {
  candidate: "candidates:read",
  job: "jobs:read",
  application: "applications:read",
  invitation: "invitations:read",
  interview: "interviews:read",
  report: "reports:read",
};

export class WorkspaceSearchService {
  public constructor(private readonly provider: WorkspaceSearchProvider) {}

  public async search(scope: SearchScope, query: SearchQuery): Promise<SearchResultPage> {
    if (!hasPermission(scope.permissionSet, "search:workspace")) {
      return { results: [], nextCursor: null, hasMore: false, searchedCategories: [] };
    }

    const normalizedQuery = normalizeSearchQuery(query.query);
    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      return { results: [], nextCursor: null, hasMore: false, searchedCategories: [] };
    }

    const categories = resolveAllowedCategories(scope, query.categories);
    if (categories.length === 0) {
      return { results: [], nextCursor: null, hasMore: false, searchedCategories: [] };
    }

    const limit = clampLimit(query.limit);
    const providerResults = await this.provider.search({
      scope,
      query: normalizedQuery,
      categories,
      limit: limit + 1,
      cursor: parseSearchCursor(query.cursor),
    });
    const sorted = [...providerResults].sort(compareSearchResults);
    const page = sorted.slice(0, limit);
    const hasMore = sorted.length > limit;
    const last = page.at(-1);

    return {
      results: page,
      nextCursor: hasMore && last !== undefined ? createSearchCursor(last) : null,
      hasMore,
      searchedCategories: categories,
    };
  }
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

function clampLimit(limit: number | null | undefined): number {
  if (limit === null || limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function resolveAllowedCategories(
  scope: SearchScope,
  requestedCategories: readonly SearchCategory[] | undefined,
): SearchCategory[] {
  const requested = new Set(requestedCategories ?? searchCategories);
  return searchCategories.filter(
    (category) =>
      requested.has(category) && hasPermission(scope.permissionSet, CATEGORY_PERMISSION[category]),
  );
}
