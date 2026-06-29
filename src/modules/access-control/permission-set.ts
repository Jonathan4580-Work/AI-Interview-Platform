import type { PermissionKey, PermissionSet } from "./types";

export function createPermissionSet(permissions: readonly PermissionKey[]): PermissionSet {
  return {
    permissions: new Set(permissions),
  };
}

export function hasPermission(permissionSet: PermissionSet, permission: PermissionKey): boolean {
  return permissionSet.permissions.has(permission);
}
