import { describe, expect, it } from "vitest";

import {
  assertRegionTransferAllowed,
  createDefaultResidencyPolicy,
  createMigrationPlanningMetadata,
  getRegionStorageConfiguration,
} from "@/modules/data-residency";

describe("data residency foundation", () => {
  it("creates tenant region policy without allowing automatic data movement", () => {
    const policy = createDefaultResidencyPolicy("company_1", "EU");
    const migration = createMigrationPlanningMetadata(policy, "US");

    expect(policy).toMatchObject({
      companyId: "company_1",
      primaryRegion: "EU",
      storageRegion: "EU",
      crossRegionTransfersAllowed: false,
    });
    expect(migration).toEqual({
      companyId: "company_1",
      currentRegion: "EU",
      requestedRegion: "US",
      requiresManualApproval: true,
      automaticDataMovementAllowed: false,
    });
  });

  it("keeps region storage configuration provider-neutral", () => {
    expect(getRegionStorageConfiguration("APAC")).toMatchObject({
      region: "APAC",
      objectStorageRegion: "ap-southeast-1",
      providerPolicy: "restricted",
    });
  });

  it("blocks cross-region transfers unless tenant policy allows them", () => {
    const policy = createDefaultResidencyPolicy("company_1", "EU");

    expect(() => {
      assertRegionTransferAllowed(policy, {
        companyId: "company_1",
        sourceRegion: "EU",
        targetRegion: "US",
        purpose: "processing",
      });
    }).toThrow("Cross-region transfers are disabled");

    expect(() => {
      assertRegionTransferAllowed(
        { ...policy, crossRegionTransfersAllowed: true },
        {
          companyId: "company_1",
          sourceRegion: "EU",
          targetRegion: "US",
          purpose: "migration_planning",
        },
      );
    }).not.toThrow();
  });

  it("never permits support access to move tenant data across regions", () => {
    expect(() => {
      assertRegionTransferAllowed(
        { ...createDefaultResidencyPolicy("company_1", "EU"), crossRegionTransfersAllowed: true },
        {
          companyId: "company_1",
          sourceRegion: "EU",
          targetRegion: "US",
          purpose: "support_access",
        },
      );
    }).toThrow("Support access must not move");
  });
});
