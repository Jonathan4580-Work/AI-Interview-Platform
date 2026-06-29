import { describe, expect, it } from "vitest";

import {
  createPermissionSet,
  evaluateAccess,
  hasPermission,
  permissionKeys,
  requirePermission,
} from "@/modules/access-control";
import { supportAccessPermissions } from "@/modules/support-access";
import { createTenantContext } from "@/modules/tenant";

describe("access control module", () => {
  it("checks permission membership", () => {
    const permissions = createPermissionSet(["tenant:read", "audit:write"]);

    expect(hasPermission(permissions, "tenant:read")).toBe(true);
    expect(hasPermission(permissions, "users:manage")).toBe(false);
  });

  it("returns an allow decision when the permission is present", () => {
    const decision = evaluateAccess({
      tenant: createTenantContext("cm0tenant001"),
      permissionSet: createPermissionSet(["users:read"]),
      required: "users:read",
    });

    expect(decision).toEqual({
      allowed: true,
      reason: "permission_granted",
    });
  });

  it("returns a deny decision when the permission is missing", () => {
    const decision = evaluateAccess({
      tenant: createTenantContext("cm0tenant001"),
      permissionSet: createPermissionSet(["users:read"]),
      required: "roles:manage",
    });

    expect(decision).toEqual({
      allowed: false,
      reason: "permission_missing",
    });
  });

  it("throws from requirePermission when permission is missing", () => {
    const permissions = createPermissionSet(["users:read"]);

    expect(() => {
      requirePermission(permissions, "roles:manage");
    }).toThrow("Permission denied: roles:manage");
  });

  it("keeps support access permissions inside the central permission catalog", () => {
    expect(permissionKeys).toContain(supportAccessPermissions.read);
    expect(permissionKeys).toContain(supportAccessPermissions.manage);
  });
});
