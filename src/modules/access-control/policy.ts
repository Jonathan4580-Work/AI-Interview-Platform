import { hasPermission } from "./permission-set";

import type { AccessDecision, AccessPolicyInput, PermissionKey, PermissionSet } from "./types";

export function evaluateAccess(input: AccessPolicyInput): AccessDecision {
  if (!hasPermission(input.permissionSet, input.required)) {
    return {
      allowed: false,
      reason: "permission_missing",
    };
  }

  return {
    allowed: true,
    reason: "permission_granted",
  };
}

export function requirePermission(
  permissionSet: PermissionSet,
  permission: PermissionKey,
): asserts permissionSet is PermissionSet {
  if (!hasPermission(permissionSet, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}
