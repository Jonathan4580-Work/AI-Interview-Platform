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

const updateTemplateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  pipelineId: z.string().min(1).nullable().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
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
    .nullable()
    .optional(),
  workplaceType: z.enum(["ONSITE", "HYBRID", "REMOTE"]).nullable().optional(),
  seniorityLevel: z.enum(["ENTRY", "MID", "SENIOR", "STAFF", "EXECUTIVE"]).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly jobTemplateId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "job_templates:read");
    const { jobTemplateId } = await context.params;
    const jobTemplate = await prisma.jobTemplate.findUnique({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(jobTemplateId) } },
    });
    if (jobTemplate === null) {
      throw notFound("Job template was not found.");
    }
    return apiSuccess(requestContext, { jobTemplate });
  })(request);
}

export async function PUT(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly jobTemplateId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantMutationPermission(innerRequest, "job_templates:manage");
    const { jobTemplateId } = await context.params;
    const body = await parseJsonBody(innerRequest, updateTemplateSchema);
    const jobTemplate = await prisma.jobTemplate.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(jobTemplateId) } },
      data: {
        title: body.title,
        slug: body.title === undefined ? undefined : slugifyApiValue(body.title),
        status: body.status,
        pipelineId: body.pipelineId,
        descriptionJson: body.description,
        requirementsJson: body.requirements,
        employmentType: body.employmentType,
        workplaceType: body.workplaceType,
        seniorityLevel: body.seniorityLevel,
      },
    });
    return apiSuccess(requestContext, { jobTemplate });
  })(request);
}

export async function DELETE(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly jobTemplateId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantMutationPermission(innerRequest, "job_templates:manage");
    const { jobTemplateId } = await context.params;
    const jobTemplate = await prisma.jobTemplate.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(jobTemplateId) } },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });
    return apiSuccess(requestContext, { jobTemplate });
  })(request);
}
