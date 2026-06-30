import { normalizeEmail } from "@/modules/identity";

import type { ScimExternalMapping, ScimResourceType } from "./types";
import type { TenantId } from "@/modules/tenant";

export class ScimDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ScimDomainError";
  }
}

export interface ScimUserInput {
  readonly companyId: TenantId;
  readonly externalId: string;
  readonly userName: string;
  readonly active: boolean;
  readonly roleKeys: readonly string[];
}

export interface ScimProvisioningDecision {
  readonly normalizedEmail: string;
  readonly action: "provision" | "update" | "deactivate" | "reactivate";
  readonly revokeActiveSessions: boolean;
}

export function decideScimUserProvisioning(input: ScimUserInput): ScimProvisioningDecision {
  const normalizedEmail = normalizeEmail(input.userName);
  if (input.roleKeys.includes("platform_admin")) {
    throw new ScimDomainError("SCIM cannot provision Platform Admin users.");
  }
  return {
    normalizedEmail,
    action: input.active ? "provision" : "deactivate",
    revokeActiveSessions: !input.active,
  };
}

export function createScimMapping(input: {
  readonly companyId: TenantId;
  readonly scimConfigurationId: ScimExternalMapping["scimConfigurationId"];
  readonly resourceType: ScimResourceType;
  readonly externalId: string;
  readonly aptlyResourceType: ScimExternalMapping["aptlyResourceType"];
  readonly aptlyResourceId: string;
}): ScimExternalMapping {
  if (input.externalId.trim().length === 0) {
    throw new ScimDomainError("SCIM externalId is required.");
  }
  return {
    companyId: input.companyId,
    scimConfigurationId: input.scimConfigurationId,
    resourceType: input.resourceType,
    externalId: input.externalId,
    aptlyResourceType: input.aptlyResourceType,
    aptlyResourceId: input.aptlyResourceId,
    active: true,
  };
}

export function parseScimPagination(input: {
  readonly startIndex?: number;
  readonly count?: number;
}): { readonly startIndex: number; readonly count: number } {
  return {
    startIndex: Math.max(1, input.startIndex ?? 1),
    count: Math.min(Math.max(1, input.count ?? 100), 200),
  };
}
