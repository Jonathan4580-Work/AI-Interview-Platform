import type { TenantContext } from "@/modules/tenant";

export const permissionKeys = [
  "tenant:read",
  "tenant:manage",
  "users:read",
  "users:manage",
  "roles:read",
  "roles:manage",
  "audit:write",
  "audit:read",
  "support_access:read",
  "support_access:manage",
  "legal_holds:read",
  "legal_holds:manage",
  "privacy_requests:read",
  "privacy_requests:manage",
  "exports:read",
  "exports:manage",
  "entitlements:read",
  "entitlements:manage",
  "departments:read",
  "departments:manage",
  "teams:read",
  "teams:manage",
  "locations:read",
  "locations:manage",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

export interface PermissionSet {
  readonly permissions: ReadonlySet<PermissionKey>;
}

export interface AccessPolicyInput {
  readonly tenant: TenantContext;
  readonly permissionSet: PermissionSet;
  readonly required: PermissionKey;
}

export interface AccessDecision {
  readonly allowed: boolean;
  readonly reason: "permission_granted" | "permission_missing";
}
