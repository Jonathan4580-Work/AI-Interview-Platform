import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, parseSearchParams, withApiHandler } from "@/server/api";

import {
  listQuerySchema,
  requireTenantMutationPermission,
  requireTenantWithPermission,
  slugifyApiValue,
} from "../_shared";

const locationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mode: z.enum(["ONSITE", "HYBRID", "REMOTE"]),
  address: z.record(z.string(), z.string()).nullable().optional(),
  timeZone: z.string().trim().min(1).max(100).nullable().optional(),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantWithPermission(request, "locations:read");
  const query = parseSearchParams(request, listQuerySchema);
  const locations = await prisma.location.findMany({
    where: {
      companyId: tenant.companyId,
      ...(query.status === undefined ? {} : { status: query.status.toUpperCase() as never }),
    },
    orderBy: { [query.sort === "name" ? "name" : "createdAt"]: query.direction },
    take: query.limit,
    ...(query.cursor === undefined
      ? {}
      : { cursor: { companyId_id: { companyId: tenant.companyId, id: query.cursor } }, skip: 1 }),
  });

  return apiSuccess(requestContext, { locations });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantMutationPermission(request, "locations:manage");
  const body = await parseJsonBody(request, locationSchema);
  const location = await prisma.location.create({
    data: {
      companyId: tenant.companyId,
      name: body.name,
      slug: slugifyApiValue(body.name),
      mode: body.mode,
      addressJson: toPrismaJson(body.address),
      timeZone: body.timeZone ?? null,
    },
  });

  return apiSuccess(requestContext, { location }, { status: 201 });
});

function toPrismaJson(value: Record<string, string> | null | undefined) {
  if (value === undefined) {
    return undefined;
  }
  return value ?? Prisma.JsonNull;
}
