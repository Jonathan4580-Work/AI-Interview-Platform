import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, parseSearchParams, withApiHandler } from "@/server/api";

import {
  listQuerySchema,
  requirePlatformMutationPermission,
  requirePlatformPermission,
  slugifyApiValue,
} from "../_shared";

const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(140).optional(),
  primaryDomain: z.string().trim().min(1).max(253).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  await requirePlatformPermission(request, "tenant:read");
  const query = parseSearchParams(request, listQuerySchema);
  const companies = await prisma.company.findMany({
    where: query.status === undefined ? {} : { status: query.status.toUpperCase() as never },
    orderBy: { [query.sort === "name" ? "name" : "createdAt"]: query.direction },
    take: query.limit,
    ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
  });

  return apiSuccess(requestContext, { companies });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  await requirePlatformMutationPermission(request, "tenant:manage");
  const body = await parseJsonBody(request, createCompanySchema);
  const company = await prisma.company.create({
    data: {
      name: body.name,
      slug: body.slug ?? slugifyApiValue(body.name),
      primaryDomain: body.primaryDomain ?? null,
      logoUrl: body.logoUrl ?? null,
    },
  });

  return apiSuccess(requestContext, { company }, { status: 201 });
});
