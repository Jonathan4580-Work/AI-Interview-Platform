import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  parseIdParam,
  requireTenantMutationPermission,
  requireTenantWithPermission,
  slugifyApiValue,
} from "../../../_shared";

import type { NextRequest } from "next/server";

const stageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(["APPLICATION_REVIEW", "SCREEN", "INTERVIEW", "OFFER", "HIRED", "REJECTED"]),
  position: z.number().int().min(1).max(1000),
  isTerminal: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly pipelineId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "pipelines:read");
    const { pipelineId } = await context.params;
    const stages = await prisma.pipelineStage.findMany({
      where: {
        companyId: tenant.companyId,
        pipelineId: parseIdParam(pipelineId),
      },
      orderBy: { position: "asc" },
    });
    return apiSuccess(requestContext, { stages });
  })(request);
}

export async function POST(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly pipelineId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantMutationPermission(innerRequest, "pipelines:manage");
    const { pipelineId } = await context.params;
    const body = await parseJsonBody(innerRequest, stageSchema);
    const stage = await prisma.pipelineStage.create({
      data: {
        companyId: tenant.companyId,
        pipelineId: parseIdParam(pipelineId),
        name: body.name,
        slug: slugifyApiValue(body.name),
        category: body.category,
        position: body.position,
        isTerminal: body.isTerminal ?? (body.category === "HIRED" || body.category === "REJECTED"),
      },
    });
    return apiSuccess(requestContext, { stage }, { status: 201 });
  })(request);
}
