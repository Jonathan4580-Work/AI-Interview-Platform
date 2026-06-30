import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, parseSearchParams, withApiHandler } from "@/server/api";

import { listQuerySchema, requireTenantWithPermission, slugifyApiValue } from "../_shared";

const jobContentSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  details: z.string().trim().max(10000).optional(),
});

const requirementsSchema = z.object({
  items: z.array(z.string().trim().min(1).max(500)).max(100),
});

const jobSchema = z.object({
  title: z.string().trim().min(2).max(120),
  pipelineId: z.string().min(1),
  departmentId: z.string().min(1).nullable().optional(),
  teamId: z.string().min(1).nullable().optional(),
  locationId: z.string().min(1).nullable().optional(),
  description: jobContentSchema,
  requirements: requirementsSchema,
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP"]),
  workplaceType: z.enum(["ONSITE", "HYBRID", "REMOTE"]),
  seniorityLevel: z.enum(["ENTRY", "MID", "SENIOR", "STAFF", "EXECUTIVE"]),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantWithPermission(request, "jobs:read");
  const query = parseSearchParams(request, listQuerySchema);
  const jobs = await prisma.job.findMany({
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

  return apiSuccess(requestContext, { jobs });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantWithPermission(request, "jobs:manage");
  const body = await parseJsonBody(request, jobSchema);
  const job = await prisma.job.create({
    data: {
      companyId: tenant.companyId,
      title: body.title,
      slug: slugifyApiValue(body.title),
      pipelineId: body.pipelineId,
      departmentId: body.departmentId ?? null,
      teamId: body.teamId ?? null,
      locationId: body.locationId ?? null,
      descriptionJson: body.description,
      requirementsJson: body.requirements,
      employmentType: body.employmentType,
      workplaceType: body.workplaceType,
      seniorityLevel: body.seniorityLevel,
    },
  });

  return apiSuccess(requestContext, { job }, { status: 201 });
});
