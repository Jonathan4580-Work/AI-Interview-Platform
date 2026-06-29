import type { TenantContext, TenantId } from "./types";

const tenantIdPattern = /^c[a-z0-9]{8,}$/i;

export function toTenantId(value: string): TenantId {
  const trimmed = value.trim();

  if (!tenantIdPattern.test(trimmed)) {
    throw new Error("Invalid tenant identifier.");
  }

  return trimmed as TenantId;
}

export function createTenantContext(companyId: string): TenantContext {
  return {
    companyId: toTenantId(companyId),
  };
}

export function assertSameTenant(expected: TenantContext, actualCompanyId: string): void {
  if (expected.companyId !== actualCompanyId) {
    throw new Error("Cross-tenant access denied.");
  }
}
