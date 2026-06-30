import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/infra/database";
import { apiSuccess, notFound, parseJsonBody, withApiHandler } from "@/server/api";

import { parseIdParam, requireTenantWithPermission, slugifyApiValue } from "../../_shared";

import type { NextRequest } from "next/server";

const updateLocationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  mode: z.enum(["ONSITE", "HYBRID", "REMOTE"]).optional(),
  address: z.record(z.string(), z.string()).nullable().optional(),
  timeZone: z.string().trim().min(1).max(100).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly locationId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "locations:read");
    const { locationId } = await context.params;
    const location = await prisma.location.findUnique({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(locationId) } },
    });
    if (location === null) {
      throw notFound("Location was not found.");
    }
    return apiSuccess(requestContext, { location });
  })(request);
}

export async function PUT(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly locationId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "locations:manage");
    const { locationId } = await context.params;
    const body = await parseJsonBody(innerRequest, updateLocationSchema);
    const location = await prisma.location.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(locationId) } },
      data: {
        name: body.name,
        slug: body.name === undefined ? undefined : slugifyApiValue(body.name),
        mode: body.mode,
        addressJson: toPrismaJson(body.address),
        timeZone: body.timeZone,
      },
    });

    return apiSuccess(requestContext, { location });
  })(request);
}

function toPrismaJson(value: Record<string, string> | null | undefined) {
  if (value === undefined) {
    return undefined;
  }
  return value ?? Prisma.JsonNull;
}

export async function DELETE(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly locationId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "locations:manage");
    const { locationId } = await context.params;
    const location = await prisma.location.update({
      where: { companyId_id: { companyId: tenant.companyId, id: parseIdParam(locationId) } },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });

    return apiSuccess(requestContext, { location });
  })(request);
}
