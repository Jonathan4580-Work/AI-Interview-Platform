import { CompanyStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  assertSameTenant,
  createTenantContext,
  isTenantOperational,
  mapCompanyStatus,
  toTenantId,
} from "@/modules/tenant";

describe("tenant module", () => {
  it("creates tenant context from a valid company id", () => {
    const context = createTenantContext("cm0tenant001");

    expect(context.companyId).toBe("cm0tenant001");
  });

  it("rejects malformed tenant identifiers", () => {
    expect(() => toTenantId("not-a-cuid")).toThrow("Invalid tenant identifier.");
  });

  it("denies cross-tenant access", () => {
    const context = createTenantContext("cm0tenant001");

    expect(() => {
      assertSameTenant(context, "cm0tenant002");
    }).toThrow("Cross-tenant access denied.");
  });

  it("maps database tenant status to domain status", () => {
    expect(mapCompanyStatus(CompanyStatus.ACTIVE)).toBe("active");
    expect(isTenantOperational("trialing")).toBe(true);
    expect(isTenantOperational("suspended")).toBe(false);
  });
});
