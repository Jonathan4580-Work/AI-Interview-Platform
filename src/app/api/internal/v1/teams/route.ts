import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, parseSearchParams, withApiHandler } from "@/server/api";

import {
  listQuerySchema,
  optionalTextSchema,
  requireTenantWithPermission,
  slugifyApiValue,
} from "../_shared";

const teamSchema = z.object({
  name: z.string().trim().min(2).max(120),
  departmentId: z.string().min(1).nullable().optional(),
  description: optionalTextSchema,
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantWithPermission(request, "teams:read");
  const query = parseSearchParams(request, listQuerySchema);
  const teams = await prisma.team.findMany({
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

  return apiSuccess(requestContext, { teams });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantWithPermission(request, "teams:manage");
  const body = await parseJsonBody(request, teamSchema);
  const team = await prisma.team.create({
    data: {
      companyId: tenant.companyId,
      departmentId: body.departmentId ?? null,
      name: body.name,
      slug: slugifyApiValue(body.name),
      description: body.description ?? null,
    },
  });

  return apiSuccess(requestContext, { team }, { status: 201 });
});
