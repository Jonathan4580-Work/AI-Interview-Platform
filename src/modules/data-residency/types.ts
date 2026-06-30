export type DataRegionKey = "US" | "EU" | "APAC";

export interface RegionStorageConfiguration {
  readonly region: DataRegionKey;
  readonly objectStorageRegion: string;
  readonly bucketReference: string;
  readonly providerPolicy: "default" | "restricted" | "in_region_only";
}

export interface DataResidencyPolicy {
  readonly companyId: string;
  readonly primaryRegion: DataRegionKey;
  readonly storageRegion: DataRegionKey;
  readonly crossRegionTransfersAllowed: boolean;
  readonly policyVersion: string;
}

export interface RegionTransferRequest {
  readonly companyId: string;
  readonly sourceRegion: DataRegionKey;
  readonly targetRegion: DataRegionKey;
  readonly purpose: "storage" | "processing" | "support_access" | "migration_planning";
}

export interface MigrationPlanningMetadata {
  readonly companyId: string;
  readonly currentRegion: DataRegionKey;
  readonly requestedRegion: DataRegionKey;
  readonly requiresManualApproval: boolean;
  readonly automaticDataMovementAllowed: false;
}
