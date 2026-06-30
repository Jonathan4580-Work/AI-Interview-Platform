import { describe, expect, it } from "vitest";

import {
  ScimDomainError,
  ScimSecurityError,
  createScimBearerToken,
  createScimMapping,
  decideScimUserProvisioning,
  hashScimBearerToken,
  parseScimPagination,
  verifyScimBearerToken,
} from "@/modules/scim";
import { toTenantId } from "@/modules/tenant";

import type { ScimConfigurationId } from "@/modules/scim";

describe("SCIM foundation", () => {
  it("stores bearer tokens only as hashes and verifies timing-safe tokens", () => {
    const token = createScimBearerToken();
    const hash = hashScimBearerToken(token, "fixed-salt");

    expect(hash).not.toContain(token);
    expect(verifyScimBearerToken(token, hash)).toBe(true);
    expect(verifyScimBearerToken(createScimBearerToken(), hash)).toBe(false);
    expect(() => hashScimBearerToken("short")).toThrow(ScimSecurityError);
  });

  it("prevents SCIM from provisioning Platform Admin users", () => {
    expect(() =>
      decideScimUserProvisioning({
        companyId,
        externalId: "external-user-1",
        userName: "admin@example.com",
        active: true,
        roleKeys: ["platform_admin"],
      }),
    ).toThrow(ScimDomainError);
  });

  it("normalizes user provisioning and revokes sessions on deactivation", () => {
    const active = decideScimUserProvisioning({
      companyId,
      externalId: "external-user-1",
      userName: " Recruiter@Example.COM ",
      active: true,
      roleKeys: ["hr"],
    });
    const inactive = decideScimUserProvisioning({
      companyId,
      externalId: "external-user-1",
      userName: "recruiter@example.com",
      active: false,
      roleKeys: ["hr"],
    });

    expect(active).toMatchObject({
      normalizedEmail: "recruiter@example.com",
      action: "provision",
      revokeActiveSessions: false,
    });
    expect(inactive).toMatchObject({
      action: "deactivate",
      revokeActiveSessions: true,
    });
  });

  it("creates tenant-scoped mappings and bounds pagination", () => {
    const mapping = createScimMapping({
      companyId,
      scimConfigurationId: "scim_1" as ScimConfigurationId,
      resourceType: "User",
      externalId: "external-user-1",
      aptlyResourceType: "user",
      aptlyResourceId: "user_1",
    });

    expect(mapping).toMatchObject({
      companyId,
      resourceType: "User",
      externalId: "external-user-1",
      active: true,
    });
    expect(parseScimPagination({ startIndex: -10, count: 500 })).toEqual({
      startIndex: 1,
      count: 200,
    });
  });
});

const companyId = toTenantId("cscim0001");
