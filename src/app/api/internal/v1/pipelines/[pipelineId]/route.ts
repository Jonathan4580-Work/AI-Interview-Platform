import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, notFound, parseJsonBody, withApiHandler } from "@/server/api";

import {
  optionalTextSchema,
  parseIdParam,
  requireTenantMutationPermission,
  requireTenantWithPermission,
  slugifyApiValue,
} from "../../_shared";

import type { NextRequest } from "next/server";

const updatePipelineSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: optionalTextSchema,
});

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly pipelineId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "pipelines:read");
    const { pipelineId } = await context.params;
    const pipeline = await prisma.hiringPipeline.findUnique({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(pipelineId) } },
    });
    if (pipeline === null) {
      throw notFound("Hiring pipeline was not found.");
    }
    return apiSuccess(requestContext, { pipeline });
  })(request);
}

export async function PUT(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly pipelineId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantMutationPermission(innerRequest, "pipelines:manage");
    const { pipelineId } = await context.params;
    const body = await parseJsonBody(innerRequest, updatePipelineSchema);
    const pipeline = await prisma.hiringPipeline.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(pipelineId) } },
      data: {
        name: body.name,
        slug: body.name === undefined ? undefined : slugifyApiValue(body.name),
        description: body.description,
      },
    });
    return apiSuccess(requestContext, { pipeline });
  })(request);
}

export async function DELETE(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly pipelineId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantMutationPermission(innerRequest, "pipelines:manage");
    const { pipelineId } = await context.params;
    const pipeline = await prisma.hiringPipeline.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(pipelineId) } },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });
    return apiSuccess(requestContext, { pipeline });
  })(request);
}
