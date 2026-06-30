import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, notFound, parseJsonBody, withApiHandler } from "@/server/api";

import {
  parseIdParam,
  requireTenantMutationPermission,
  requireTenantWithPermission,
  slugifyApiValue,
} from "../../../../_shared";

import type { NextRequest } from "next/server";

const updateStageSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  category: z
    .enum(["APPLICATION_REVIEW", "SCREEN", "INTERVIEW", "OFFER", "HIRED", "REJECTED"])
    .optional(),
  position: z.number().int().min(1).max(1000).optional(),
  isTerminal: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly pipelineId: string; readonly stageId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "pipelines:read");
    const { pipelineId, stageId } = await context.params;
    const stage = await prisma.pipelineStage.findFirst({
      where: {
        companyId: tenant.companyId,
        pipelineId: parseIdParam(pipelineId),
        id: parseIdParam(stageId),
      },
    });
    if (stage === null) {
      throw notFound("Pipeline stage was not found.");
    }
    return apiSuccess(requestContext, { stage });
  })(request);
}

export async function PUT(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly pipelineId: string; readonly stageId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantMutationPermission(innerRequest, "pipelines:manage");
    const { pipelineId, stageId } = await context.params;
    const body = await parseJsonBody(innerRequest, updateStageSchema);
    await requireStageInPipeline({
      companyId: tenant.companyId,
      pipelineId: parseIdParam(pipelineId),
      stageId: parseIdParam(stageId),
    });
    const stage = await prisma.pipelineStage.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(stageId) } },
      data: {
        name: body.name,
        slug: body.name === undefined ? undefined : slugifyApiValue(body.name),
        category: body.category,
        position: body.position,
        isTerminal: body.isTerminal,
      },
    });
    return apiSuccess(requestContext, { stage });
  })(request);
}

export async function DELETE(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly pipelineId: string; readonly stageId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantMutationPermission(innerRequest, "pipelines:manage");
    const { pipelineId, stageId } = await context.params;
    await requireStageInPipeline({
      companyId: tenant.companyId,
      pipelineId: parseIdParam(pipelineId),
      stageId: parseIdParam(stageId),
    });
    const stage = await prisma.pipelineStage.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(stageId) } },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });
    return apiSuccess(requestContext, { stage });
  })(request);
}

async function requireStageInPipeline(input: {
  readonly companyId: string;
  readonly pipelineId: string;
  readonly stageId: string;
}): Promise<void> {
  const stage = await prisma.pipelineStage.findFirst({
    where: {
      companyId: input.companyId,
      pipelineId: input.pipelineId,
      id: input.stageId,
    },
    select: { id: true },
  });
  if (stage === null) {
    throw notFound("Pipeline stage was not found.");
  }
}
