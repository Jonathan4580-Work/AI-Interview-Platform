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

const updateDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: optionalTextSchema,
});

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly departmentId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "departments:read");
    const { departmentId } = await context.params;
    const department = await prisma.department.findUnique({
      where: {
        companyId_id: {
          companyId: tenant.companyId,
          id: parseIdParam(departmentId),
        },
      },
    });
    if (department === null) {
      throw notFound("Department was not found.");
    }
    return apiSuccess(requestContext, { department });
  })(request);
}

export async function PUT(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly departmentId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "departments:manage");
    const { departmentId } = await context.params;
    const body = await parseJsonBody(innerRequest, updateDepartmentSchema);
    const department = await prisma.department.update({
      where: {
        companyId_id: {
          companyId: tenant.companyId,
          id: parseIdParam(departmentId),
        },
      },
      data: {
        name: body.name,
        slug: body.name === undefined ? undefined : slugifyApiValue(body.name),
        description: body.description,
      },
    });

    return apiSuccess(requestContext, { department });
  })(request);
}

export async function DELETE(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly departmentId: string }> },
) {
  return withApiHandler(async (innerRequest, { requestContext }) => {
    const tenant = await requireTenantWithPermission(innerRequest, "departments:manage");
    const { departmentId } = await context.params;
    const department = await prisma.department.update({
      where: {
        companyId_id: {
          companyId: tenant.companyId,
          id: parseIdParam(departmentId),
        },
      },
      data: {
        status: "ARCHIVED",
        deletedAt: new Date(),
      },
    });

    return apiSuccess(requestContext, { department });
  })(request);
}
