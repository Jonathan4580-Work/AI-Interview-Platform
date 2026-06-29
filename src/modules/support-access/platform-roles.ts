import type { PermissionKey } from "@/modules/access-control";

export const platformSupportRoles = ["support", "compliance", "operations", "super_admin"] as const;

export type PlatformSupportRole = (typeof platformSupportRoles)[number];

export const supportAccessPermissions = {
  read: "support_access:read",
  manage: "support_access:manage",
} as const satisfies Record<string, PermissionKey>;
