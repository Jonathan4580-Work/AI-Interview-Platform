import { prisma } from "@/infra/database";
import { parseSearchParams } from "@/server/api";

import { listQuerySchema, requireTenantWithPermission } from "../_shared";

import type { PermissionKey } from "@/modules/access-control";
import type { NextRequest } from "next/server";

export async function readCandidatePortalListContext(
  request: NextRequest,
  permission: PermissionKey,
) {
  const tenant = await requireTenantWithPermission(request, permission);
  const query = parseSearchParams(request, listQuerySchema);
  return { tenant, query };
}

export function pageArgs(query: { readonly limit: number; readonly cursor?: string }) {
  return {
    take: query.limit,
    ...(query.cursor === undefined ? {} : { skip: 1, cursor: { id: query.cursor } }),
  };
}

export { prisma };
