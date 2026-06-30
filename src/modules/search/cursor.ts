import { z } from "zod";

import { searchCategories, type SearchCursor, type SearchResult } from "./types";

const cursorSchema = z.object({
  score: z.number().int().min(0),
  category: z.enum(searchCategories),
  updatedAt: z.string().datetime(),
  id: z.string().min(1).max(256),
});

export function createSearchCursor(result: SearchResult): string {
  return Buffer.from(
    JSON.stringify({
      score: result.score,
      category: result.category,
      updatedAt: result.updatedAt.toISOString(),
      id: result.id,
    } satisfies SearchCursor),
    "utf8",
  ).toString("base64url");
}

export function parseSearchCursor(cursor: string | null | undefined): SearchCursor | null {
  if (cursor === null || cursor === undefined) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    return cursorSchema.parse(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export function isAfterSearchCursor(result: SearchResult, cursor: SearchCursor | null): boolean {
  if (cursor === null) {
    return true;
  }

  const current = toSortTuple(
    result.score,
    result.category,
    result.updatedAt.toISOString(),
    result.id,
  );
  const previous = toSortTuple(cursor.score, cursor.category, cursor.updatedAt, cursor.id);

  for (const [index, value] of current.entries()) {
    const other = previous[index];
    if (value === other) {
      continue;
    }

    return value > other;
  }

  return false;
}

export function compareSearchResults(left: SearchResult, right: SearchResult): number {
  const leftTuple = toSortTuple(left.score, left.category, left.updatedAt.toISOString(), left.id);
  const rightTuple = toSortTuple(
    right.score,
    right.category,
    right.updatedAt.toISOString(),
    right.id,
  );

  for (const [index, leftValue] of leftTuple.entries()) {
    const rightValue = rightTuple[index];
    if (leftValue === rightValue) {
      continue;
    }

    return leftValue < rightValue ? -1 : 1;
  }

  return 0;
}

function toSortTuple(
  score: number,
  category: string,
  updatedAt: string,
  id: string,
): readonly [number, string, string, string] {
  return [-score, category, invertIsoTimestamp(updatedAt), id];
}

function invertIsoTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return String(Number.MAX_SAFE_INTEGER - timestamp).padStart(16, "0");
}
