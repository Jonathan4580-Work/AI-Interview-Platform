import { hasPermission } from "@/modules/access-control";
import { forbidden } from "@/server/api";

import type { PermissionKey } from "@/modules/access-control";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { NextRequest } from "next/server";
import type { AuthenticatedContext } from "./context";

export function requirePermissionForContext(
  auth: AuthenticatedContext,
  permission: PermissionKey,
): void {
  if (!hasPermission(auth.permissionSet, permission)) {
    throw forbidden(`Permission denied: ${permission}`);
  }
}

export function requireTenantContext(
  auth: AuthenticatedContext,
  request: NextRequest,
): TenantContext {
  if (auth.kind === "company") {
    return auth.tenant;
  }

  const companyId = request.headers.get("x-company-id")?.trim();
  if (companyId === undefined || companyId.length === 0) {
    throw forbidden("Platform requests must include an x-company-id tenant scope.");
  }

  return { companyId: companyId as TenantId };
}

export function assertTenantMatch(auth: AuthenticatedContext, companyId: TenantId): void {
  if (auth.kind === "company" && auth.tenant.companyId !== companyId) {
    throw forbidden("Authenticated user cannot access a different tenant.");
  }
}
