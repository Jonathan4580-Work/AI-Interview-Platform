import type { TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type IntegrationConnectionId = Brand<string, "IntegrationConnectionId">;
export type IntegrationSyncJobId = Brand<string, "IntegrationSyncJobId">;

export const integrationProviders = [
  "development_ats",
  "greenhouse",
  "lever",
  "workday",
  "ashby",
  "smartrecruiters",
  "other",
] as const;

export type IntegrationProvider = (typeof integrationProviders)[number];

export const integrationMappingTypes = [
  "job",
  "candidate",
  "application",
  "stage",
  "user",
] as const;
export type IntegrationMappingType = (typeof integrationMappingTypes)[number];

export const integrationConflictPolicies = [
  "aptly_wins",
  "external_wins",
  "manual_review",
  "field_specific",
] as const;

export type IntegrationConflictPolicy = (typeof integrationConflictPolicies)[number];

export interface IntegrationConnectionRecord {
  readonly id: IntegrationConnectionId;
  readonly companyId: TenantId;
  readonly provider: IntegrationProvider;
  readonly name: string;
  readonly secretRef: string | null;
  readonly externalAccountRef: string | null;
  readonly conflictPolicy: IntegrationConflictPolicy;
}

export interface IntegrationMappingRecord {
  readonly companyId: TenantId;
  readonly integrationConnectionId: IntegrationConnectionId;
  readonly mappingType: IntegrationMappingType;
  readonly externalId: string;
  readonly aptlyResourceType: string;
  readonly aptlyResourceId: string;
  readonly conflictPolicy: IntegrationConflictPolicy;
}

export interface IntegrationSyncCheckpoint {
  readonly cursor: Readonly<Record<string, unknown>>;
  readonly pageNumber: number;
  readonly recordsProcessed: number;
  readonly providerRateLimitedUntil: Date | null;
}
