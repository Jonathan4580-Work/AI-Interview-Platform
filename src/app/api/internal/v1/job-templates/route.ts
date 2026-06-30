import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, parseSearchParams, withApiHandler } from "@/server/api";

import { listQuerySchema, requireTenantWithPermission, slugifyApiValue } from "../_shared";

const templateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  pipelineId: z.string().min(1).nullable().optional(),
  description: z.object({
    summary: z.string().trim().min(1).max(2000),
    details: z.string().trim().max(10000).optional(),
  }),
  requirements: z.object({
    items: z.array(z.string().trim().min(1).max(500)).max(100),
  }),
  employmentType: z
    .enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP"])
    .nullable()
    .optional(),
  workplaceType: z.enum(["ONSITE", "HYBRID", "REMOTE"]).nullable().optional(),
  seniorityLevel: z.enum(["ENTRY", "MID", "SENIOR", "STAFF", "EXECUTIVE"]).nullable().optional(),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantWithPermission(request, "job_templates:read");
  const query = parseSearchParams(request, listQuerySchema);
  const jobTemplates = await prisma.jobTemplate.findMany({
    where: {
      companyId: tenant.companyId,
      ...(query.status === undefined ? {} : { status: query.status.toUpperCase() as never }),
    },
    orderBy: { [query.sort === "title" ? "title" : "createdAt"]: query.direction },
    take: query.limit,
    ...(query.cursor === undefined
      ? {}
      : { cursor: { companyId_id: { companyId: tenant.companyId, id: query.cursor } }, skip: 1 }),
  });
  return apiSuccess(requestContext, { jobTemplates });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantWithPermission(request, "job_templates:manage");
  const body = await parseJsonBody(request, templateSchema);
  const jobTemplate = await prisma.jobTemplate.create({
    data: {
      companyId: tenant.companyId,
      title: body.title,
      slug: slugifyApiValue(body.title),
      pipelineId: body.pipelineId ?? null,
      descriptionJson: body.description,
      requirementsJson: body.requirements,
      employmentType: body.employmentType ?? null,
      workplaceType: body.workplaceType ?? null,
      seniorityLevel: body.seniorityLevel ?? null,
    },
  });

  return apiSuccess(requestContext, { jobTemplate }, { status: 201 });
});
