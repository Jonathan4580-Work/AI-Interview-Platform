import type {
  IntegrationConflictPolicy,
  IntegrationConnectionId,
  IntegrationMappingRecord,
  IntegrationMappingType,
} from "./types";
import type { TenantId } from "@/modules/tenant";

export class IntegrationMappingError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "IntegrationMappingError";
  }
}

export function createIntegrationMapping(input: {
  readonly companyId: TenantId;
  readonly integrationConnectionId: IntegrationConnectionId;
  readonly mappingType: IntegrationMappingType;
  readonly externalId: string;
  readonly aptlyResourceType: string;
  readonly aptlyResourceId: string;
  readonly conflictPolicy: IntegrationConflictPolicy;
}): IntegrationMappingRecord {
  if (input.externalId.trim().length === 0) {
    throw new IntegrationMappingError("External integration ID is required.");
  }
  if (
    ["evaluation", "interview_plan", "human_decision", "audit_event"].includes(
      input.aptlyResourceType,
    )
  ) {
    throw new IntegrationMappingError(
      "Reviewed evaluations, interview plans, decisions, and audit history cannot be overwritten by integrations.",
    );
  }
  return {
    companyId: input.companyId,
    integrationConnectionId: input.integrationConnectionId,
    mappingType: input.mappingType,
    externalId: input.externalId,
    aptlyResourceType: input.aptlyResourceType,
    aptlyResourceId: input.aptlyResourceId,
    conflictPolicy: input.conflictPolicy,
  };
}

export function integrationExternalMappingKey(input: {
  readonly companyId: TenantId;
  readonly integrationConnectionId: IntegrationConnectionId;
  readonly mappingType: IntegrationMappingType;
  readonly externalId: string;
}): string {
  const externalId = input.externalId.trim();
  if (externalId.length === 0) {
    throw new IntegrationMappingError("External integration ID is required.");
  }
  return [
    input.companyId,
    input.integrationConnectionId,
    input.mappingType,
    externalId.toLowerCase(),
  ].join(":");
}

export function assertNoDuplicateIntegrationMapping(
  existingKeys: ReadonlySet<string>,
  mapping: IntegrationMappingRecord,
): void {
  const key = integrationExternalMappingKey(mapping);
  if (existingKeys.has(key)) {
    throw new IntegrationMappingError(
      "Integration mapping already exists for this external record.",
    );
  }
}

export function resolveIntegrationConflict(input: {
  readonly policy: IntegrationConflictPolicy;
  readonly aptlyValue: unknown;
  readonly externalValue: unknown;
}): { readonly resolution: "aptly" | "external" | "manual_review"; readonly value: unknown } {
  switch (input.policy) {
    case "aptly_wins":
      return { resolution: "aptly", value: input.aptlyValue };
    case "external_wins":
      return { resolution: "external", value: input.externalValue };
    case "manual_review":
    case "field_specific":
      return { resolution: "manual_review", value: input.aptlyValue };
  }
}
