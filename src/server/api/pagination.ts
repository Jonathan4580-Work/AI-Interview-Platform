import { z } from "zod";

export const offsetPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const sortDirectionSchema = z.enum(["asc", "desc"]);

export interface OffsetPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly skip: number;
  readonly take: number;
}

export interface CursorPagination {
  readonly cursor: string | null;
  readonly take: number;
}

export interface PaginationMeta {
  readonly page?: number;
  readonly pageSize?: number;
  readonly total?: number;
  readonly cursor?: string | null;
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}

export function toOffsetPagination(input: {
  readonly page: number;
  readonly pageSize: number;
}): OffsetPagination {
  return {
    page: input.page,
    pageSize: input.pageSize,
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize,
  };
}

export function toCursorPagination(input: {
  readonly cursor?: string | null;
  readonly limit: number;
}): CursorPagination {
  return {
    cursor: input.cursor ?? null,
    take: input.limit + 1,
  };
}

export function createOffsetPaginationMeta(input: {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}): PaginationMeta {
  return {
    page: input.page,
    pageSize: input.pageSize,
    total: input.total,
    hasMore: input.page * input.pageSize < input.total,
  };
}

export function createCursorPaginationResult<TRecord>(
  records: readonly TRecord[],
  limit: number,
  getCursor: (record: TRecord) => string,
): { readonly data: readonly TRecord[]; readonly meta: PaginationMeta } {
  const hasMore = records.length > limit;
  const data = hasMore ? records.slice(0, limit) : records;
  const last = data.at(-1);

  return {
    data,
    meta: {
      nextCursor: hasMore && last !== undefined ? getCursor(last) : null,
      hasMore,
    },
  };
}
