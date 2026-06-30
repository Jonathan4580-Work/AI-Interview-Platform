import type {
  DataRegionKey,
  DataResidencyPolicy,
  MigrationPlanningMetadata,
  RegionStorageConfiguration,
  RegionTransferRequest,
} from "./types";

export const defaultResidencyPolicyVersion = "2026-07-01";

export const regionStorageConfigurations = {
  US: {
    region: "US",
    objectStorageRegion: "us-east-1",
    bucketReference: "aptly-media-us",
    providerPolicy: "default",
  },
  EU: {
    region: "EU",
    objectStorageRegion: "eu-central-1",
    bucketReference: "aptly-media-eu",
    providerPolicy: "in_region_only",
  },
  APAC: {
    region: "APAC",
    objectStorageRegion: "ap-southeast-1",
    bucketReference: "aptly-media-apac",
    providerPolicy: "restricted",
  },
} as const satisfies Record<DataRegionKey, RegionStorageConfiguration>;

export function createDefaultResidencyPolicy(
  companyId: string,
  region: DataRegionKey = "US",
): DataResidencyPolicy {
  return {
    companyId,
    primaryRegion: region,
    storageRegion: region,
    crossRegionTransfersAllowed: false,
    policyVersion: defaultResidencyPolicyVersion,
  };
}

export function getRegionStorageConfiguration(region: DataRegionKey): RegionStorageConfiguration {
  return regionStorageConfigurations[region];
}

export function assertRegionTransferAllowed(
  policy: DataResidencyPolicy,
  request: RegionTransferRequest,
): void {
  if (policy.companyId !== request.companyId) {
    throw new Error("Data residency policy does not belong to the requested tenant.");
  }

  if (request.sourceRegion === request.targetRegion) {
    return;
  }

  if (request.purpose === "support_access") {
    throw new Error("Support access must not move tenant data across regions.");
  }

  if (!policy.crossRegionTransfersAllowed) {
    throw new Error("Cross-region transfers are disabled by tenant data-residency policy.");
  }
}

export function createMigrationPlanningMetadata(
  policy: DataResidencyPolicy,
  requestedRegion: DataRegionKey,
): MigrationPlanningMetadata {
  return {
    companyId: policy.companyId,
    currentRegion: policy.primaryRegion,
    requestedRegion,
    requiresManualApproval: policy.primaryRegion !== requestedRegion,
    automaticDataMovementAllowed: false,
  };
}
