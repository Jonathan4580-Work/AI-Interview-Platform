import type { TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type ScimConfigurationId = Brand<string, "ScimConfigurationId">;

export const scimResourceTypes = ["User", "Group"] as const;
export type ScimResourceType = (typeof scimResourceTypes)[number];

export interface ScimConfigurationRecord {
  readonly id: ScimConfigurationId;
  readonly companyId: TenantId;
  readonly tokenHash: string;
  readonly provisioningEnabled: boolean;
  readonly deprovisionRevokesSessions: boolean;
}

export interface ScimExternalMapping {
  readonly companyId: TenantId;
  readonly scimConfigurationId: ScimConfigurationId;
  readonly resourceType: ScimResourceType;
  readonly externalId: string;
  readonly aptlyResourceType: "user" | "role";
  readonly aptlyResourceId: string;
  readonly active: boolean;
}
