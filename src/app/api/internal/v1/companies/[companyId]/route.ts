import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, notFound, parseJsonBody, withApiHandler } from "@/server/api";

import { parseIdParam, requirePlatformPermission } from "../../_shared";

import type { NextRequest } from "next/server";

const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  status: z.enum(["TRIALING", "ACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
  primaryDomain: z.string().trim().min(1).max(253).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly companyId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    await requirePlatformPermission(innerRequest, "tenant:read");
    const { companyId } = await context.params;
    const company = await prisma.company.findUnique({
      where: { id: parseIdParam(companyId) },
    });
    if (company === null) {
      throw notFound("Company was not found.");
    }

    return apiSuccess(requestContext, { company });
  })(request);
}

export async function PUT(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly companyId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    await requirePlatformPermission(innerRequest, "tenant:manage");
    const { companyId } = await context.params;
    const body = await parseJsonBody(innerRequest, updateCompanySchema);
    const company = await prisma.company.update({
      where: { id: parseIdParam(companyId) },
      data: {
        name: body.name,
        status: body.status,
        primaryDomain: body.primaryDomain,
        logoUrl: body.logoUrl,
      },
    });

    return apiSuccess(requestContext, { company });
  })(request);
}

export async function DELETE(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly companyId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    await requirePlatformPermission(innerRequest, "tenant:manage");
    const { companyId } = await context.params;
    const company = await prisma.company.update({
      where: { id: parseIdParam(companyId) },
      data: {
        status: "ARCHIVED",
        deletedAt: new Date(),
      },
    });

    return apiSuccess(requestContext, { company });
  })(request);
}
