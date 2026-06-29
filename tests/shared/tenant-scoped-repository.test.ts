import { describe, expect, it } from "vitest";

import { createTenantContext } from "@/modules/tenant";
import { assertTenantRecord, assertTenantRecords, withTenantScope } from "@/shared";

describe("tenant-scoped repository helpers", () => {
  it("adds tenant scope to query filters", () => {
    const tenant = createTenantContext("cm0tenant001");

    expect(withTenantScope(tenant, { status: "active" })).toEqual({
      companyId: "cm0tenant001",
      status: "active",
    });
  });

  it("allows records from the active tenant", () => {
    const tenant = createTenantContext("cm0tenant001");
    const record = { id: "record-1", companyId: "cm0tenant001" };

    expect(assertTenantRecord(tenant, record)).toBe(record);
  });

  it("allows null records without leaking existence", () => {
    const tenant = createTenantContext("cm0tenant001");

    expect(assertTenantRecord(tenant, null)).toBeNull();
  });

  it("denies a record from another tenant", () => {
    const tenant = createTenantContext("cm0tenant001");
    const record = { id: "record-1", companyId: "cm0tenant002" };

    expect(() => {
      assertTenantRecord(tenant, record);
    }).toThrow("Cross-tenant access denied.");
  });

  it("denies mixed-tenant record collections", () => {
    const tenant = createTenantContext("cm0tenant001");

    expect(() => {
      assertTenantRecords(tenant, [
        { id: "record-1", companyId: "cm0tenant001" },
        { id: "record-2", companyId: "cm0tenant002" },
      ]);
    }).toThrow("Cross-tenant access denied.");
  });
});
