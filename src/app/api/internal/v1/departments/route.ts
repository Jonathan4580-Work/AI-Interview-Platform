import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, parseSearchParams, withApiHandler } from "@/server/api";

import {
  listQuerySchema,
  optionalTextSchema,
  requireTenantWithPermission,
  slugifyApiValue,
} from "../_shared";

const departmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalTextSchema,
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantWithPermission(request, "departments:read");
  const query = parseSearchParams(request, listQuerySchema);
  const departments = await prisma.department.findMany({
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

  return apiSuccess(requestContext, { departments });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantWithPermission(request, "departments:manage");
  const body = await parseJsonBody(request, departmentSchema);
  const department = await prisma.department.create({
    data: {
      companyId: tenant.companyId,
      name: body.name,
      slug: slugifyApiValue(body.name),
      description: body.description ?? null,
    },
  });

  return apiSuccess(requestContext, { department }, { status: 201 });
});
