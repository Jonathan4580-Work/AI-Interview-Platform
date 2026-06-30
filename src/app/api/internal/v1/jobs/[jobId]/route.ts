import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, notFound, parseJsonBody, withApiHandler } from "@/server/api";

import {
  parseIdParam,
  requireTenantMutationPermission,
  requireTenantWithPermission,
  slugifyApiValue,
} from "../../_shared";

import type { NextRequest } from "next/server";

const updateJobSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  status: z.enum(["DRAFT", "OPEN", "PAUSED", "CLOSED", "ARCHIVED"]).optional(),
  pipelineId: z.string().min(1).optional(),
  departmentId: z.string().min(1).nullable().optional(),
  teamId: z.string().min(1).nullable().optional(),
  locationId: z.string().min(1).nullable().optional(),
  description: z
    .object({
      summary: z.string().trim().min(1).max(2000),
      details: z.string().trim().max(10000).optional(),
    })
    .optional(),
  requirements: z
    .object({
      items: z.array(z.string().trim().min(1).max(500)).max(100),
    })
    .optional(),
  employmentType: z
    .enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP"])
    .optional(),
  workplaceType: z.enum(["ONSITE", "HYBRID", "REMOTE"]).optional(),
  seniorityLevel: z.enum(["ENTRY", "MID", "SENIOR", "STAFF", "EXECUTIVE"]).optional(),
});

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly jobId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "jobs:read");
    const { jobId } = await context.params;
    const job = await prisma.job.findUnique({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(jobId) } },
    });
    if (job === null) {
      throw notFound("Job was not found.");
    }
    return apiSuccess(requestContext, { job });
  })(request);
}

export async function PUT(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly jobId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantMutationPermission(innerRequest, "jobs:manage");
    const { jobId } = await context.params;
    const body = await parseJsonBody(innerRequest, updateJobSchema);
    const job = await prisma.job.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(jobId) } },
      data: {
        title: body.title,
        slug: body.title === undefined ? undefined : slugifyApiValue(body.title),
        status: body.status,
        pipelineId: body.pipelineId,
        departmentId: body.departmentId,
        teamId: body.teamId,
        locationId: body.locationId,
        descriptionJson: body.description,
        requirementsJson: body.requirements,
        employmentType: body.employmentType,
        workplaceType: body.workplaceType,
        seniorityLevel: body.seniorityLevel,
        openedAt: body.status === "OPEN" ? new Date() : undefined,
        closedAt: body.status === "CLOSED" ? new Date() : undefined,
      },
    });
    return apiSuccess(requestContext, { job });
  })(request);
}

export async function DELETE(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly jobId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantMutationPermission(innerRequest, "jobs:manage");
    const { jobId } = await context.params;
    const job = await prisma.job.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(jobId) } },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });
    return apiSuccess(requestContext, { job });
  })(request);
}
