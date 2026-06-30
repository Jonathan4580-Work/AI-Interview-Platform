import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { createPermissionSet } from "@/modules/access-control";
import {
  assertTenantMatch,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";

import type { AuthenticatedContext } from "@/server/auth";
import type { AuthSessionId } from "@/modules/auth";
import type { NormalizedEmail, PlatformUserId, UserId } from "@/modules/identity";
import type { TenantId } from "@/modules/tenant";

describe("server auth authorization", () => {
  it("requires permissions from the authenticated context", () => {
    const auth = companyAuthContext(["jobs:read"]);

    expect(() => {
      requirePermissionForContext(auth, "jobs:read");
    }).not.toThrow();
    expect(() => {
      requirePermissionForContext(auth, "jobs:manage");
    }).toThrow("Permission denied: jobs:manage");
  });

  it("uses the authenticated company tenant for company users", () => {
    const auth = companyAuthContext(["tenant:read"]);
    const request = new NextRequest("http://localhost/api/internal/v1/departments", {
      headers: { "x-company-id": "other_company" },
    });

    expect(requireTenantContext(auth, request)).toEqual({ companyId: "company_1" });
  });

  it("requires explicit tenant scope for platform users", () => {
    const auth = platformAuthContext();
    const request = new NextRequest("http://localhost/api/internal/v1/departments", {
      headers: { "x-company-id": "company_2" },
    });

    expect(requireTenantContext(auth, request)).toEqual({ companyId: "company_2" });
    expect(() => {
      requireTenantContext(auth, new NextRequest("http://localhost/api/internal/v1/departments"));
    }).toThrow("Platform requests must include an x-company-id tenant scope.");
  });

  it("blocks company users from cross-tenant resource access", () => {
    const auth = companyAuthContext(["tenant:read"]);

    expect(() => {
      assertTenantMatch(auth, "company_1" as TenantId);
    }).not.toThrow();
    expect(() => {
      assertTenantMatch(auth, "company_2" as TenantId);
    }).toThrow("Authenticated user cannot access a different tenant.");
  });
});

function companyAuthContext(
  permissions: Parameters<typeof createPermissionSet>[0],
): AuthenticatedContext {
  return {
    kind: "company",
    session: {
      id: "session_1" as AuthSessionId,
      subject: {
        type: "user",
        companyId: "company_1" as TenantId,
        userId: "user_1" as UserId,
        email: "member@example.com" as NormalizedEmail,
        name: "Member Example",
        status: "active",
      },
      status: "active",
      sessionTokenHash: "session_hash",
      refreshTokenHash: "refresh_hash",
      csrfTokenHash: "csrf_hash",
      ipAddress: null,
      userAgent: null,
      lastSeenAt: new Date("2026-06-30T00:00:00.000Z"),
      expiresAt: new Date("2026-06-30T08:00:00.000Z"),
      refreshExpiresAt: new Date("2026-07-30T00:00:00.000Z"),
      revokedAt: null,
      createdAt: new Date("2026-06-30T00:00:00.000Z"),
    },
    subject: {
      type: "user",
      companyId: "company_1" as TenantId,
      userId: "user_1" as UserId,
      email: "member@example.com" as NormalizedEmail,
      name: "Member Example",
      status: "active",
    },
    tenant: { companyId: "company_1" as TenantId },
    permissionSet: createPermissionSet(permissions),
  };
}

function platformAuthContext(): AuthenticatedContext {
  return {
    kind: "platform",
    session: {
      id: "session_2" as AuthSessionId,
      subject: {
        type: "platform_user",
        platformUserId: "platform_1" as PlatformUserId,
        email: "admin@example.com" as NormalizedEmail,
        name: "Platform Admin",
        status: "active",
      },
      status: "active",
      sessionTokenHash: "session_hash",
      refreshTokenHash: "refresh_hash",
      csrfTokenHash: "csrf_hash",
      ipAddress: null,
      userAgent: null,
      lastSeenAt: new Date("2026-06-30T00:00:00.000Z"),
      expiresAt: new Date("2026-06-30T08:00:00.000Z"),
      refreshExpiresAt: new Date("2026-07-30T00:00:00.000Z"),
      revokedAt: null,
      createdAt: new Date("2026-06-30T00:00:00.000Z"),
    },
    subject: {
      type: "platform_user",
      platformUserId: "platform_1" as PlatformUserId,
      email: "admin@example.com" as NormalizedEmail,
      name: "Platform Admin",
      status: "active",
    },
    permissionSet: createPermissionSet(["tenant:manage"]),
  };
}
