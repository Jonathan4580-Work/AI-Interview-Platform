import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, notFound, parseJsonBody, withApiHandler } from "@/server/api";

import {
  optionalTextSchema,
  parseIdParam,
  requireTenantWithPermission,
  slugifyApiValue,
} from "../../_shared";

import type { NextRequest } from "next/server";

const updateTeamSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  departmentId: z.string().min(1).nullable().optional(),
  description: optionalTextSchema,
});

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly teamId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "teams:read");
    const { teamId } = await context.params;
    const team = await prisma.team.findUnique({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(teamId) } },
    });
    if (team === null) {
      throw notFound("Team was not found.");
    }
    return apiSuccess(requestContext, { team });
  })(request);
}

export async function PUT(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly teamId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "teams:manage");
    const { teamId } = await context.params;
    const body = await parseJsonBody(innerRequest, updateTeamSchema);
    const team = await prisma.team.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(teamId) } },
      data: {
        name: body.name,
        slug: body.name === undefined ? undefined : slugifyApiValue(body.name),
        departmentId: body.departmentId,
        description: body.description,
      },
    });

    return apiSuccess(requestContext, { team });
  })(request);
}

export async function DELETE(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly teamId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "teams:manage");
    const { teamId } = await context.params;
    const team = await prisma.team.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(teamId) } },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });

    return apiSuccess(requestContext, { team });
  })(request);
}
