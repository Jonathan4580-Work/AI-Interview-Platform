import { z } from "zod";

import { PrismaWorkspaceSearchProvider, WorkspaceSearchService } from "@/modules/search";
import { apiSuccess, parseSearchParams, withApiHandler } from "@/server/api";
import {
  getAuthenticatedContext,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";

const searchQuerySchema = z.object({
  query: z.string().trim().min(1).max(120),
  categories: z
    .string()
    .max(160)
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean),
    ),
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, "search:workspace");
  const tenant = requireTenantContext(auth, request);
  const query = parseSearchParams(request, searchQuerySchema);
  const service = new WorkspaceSearchService(new PrismaWorkspaceSearchProvider());
  const result = await service.search(
    { tenant, permissionSet: auth.permissionSet },
    {
      query: query.query,
      categories: query.categories as never,
      cursor: query.cursor,
      limit: query.limit,
    },
  );

  return apiSuccess(
    requestContext,
    {
      results: result.results,
      searchedCategories: result.searchedCategories,
    },
    {
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    },
  );
});
