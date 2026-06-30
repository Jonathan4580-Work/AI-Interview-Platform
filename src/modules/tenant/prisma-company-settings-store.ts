import { Prisma, type CompanySettings as PrismaCompanySettings } from "@prisma/client";

import { prisma } from "@/infra/database";
import { assertTenantRecord } from "@/shared/repositories";

import {
  defaultBrandingSettings,
  defaultCandidatePolicySettings,
  defaultInvitationPolicySettings,
  defaultSchedulingPolicySettings,
} from "./company-settings-service";

import type {
  BrandingSettings,
  CandidatePolicySettings,
  CompanySettingsRecord,
  CompanySettingsRepository,
  InvitationPolicySettings,
  SchedulingPolicySettings,
} from "./company-settings-types";
import type { TenantContext, TenantId } from "./types";

export class PrismaCompanySettingsRepository implements CompanySettingsRepository {
  public async findByTenant(tenant: TenantContext): Promise<CompanySettingsRecord | null> {
    const record = await prisma.companySettings.findUnique({
      where: {
        companyId: tenant.companyId,
      },
    });

    const tenantRecord = assertTenantRecord(tenant, record);
    return tenantRecord === null ? null : mapCompanySettings(tenantRecord);
  }

  public async upsert(
    input: Parameters<CompanySettingsRepository["upsert"]>[0],
  ): Promise<CompanySettingsRecord> {
    const existing = await prisma.companySettings.findUnique({
      where: {
        companyId: input.companyId,
      },
    });
    const existingPolicyRoot = readObject(existing?.featureFlagsJson);
    const featureFlagsJson = settingsPoliciesToJson({
      candidatePolicy: input.candidatePolicy,
      invitationPolicy: input.invitationPolicy,
      schedulingPolicy: input.schedulingPolicy,
      flags: readObject(existingPolicyRoot.flags),
    });

    const brandingJson = brandingToJson(input.branding);

    const record = await prisma.companySettings.upsert({
      where: {
        companyId: input.companyId,
      },
      create: {
        companyId: input.companyId,
        brandingJson,
        retentionPolicyJson: {
          schemaVersion: 1,
        },
        emailSettingsJson: {
          schemaVersion: 1,
        },
        featureFlagsJson,
      },
      update: {
        brandingJson,
        featureFlagsJson,
      },
    });

    return mapCompanySettings(record);
  }
}

function brandingToJson(settings: BrandingSettings): Prisma.InputJsonObject {
  return {
    schemaVersion: settings.schemaVersion,
    displayName: settings.displayName,
    logoUrl: settings.logoUrl,
    primaryColor: settings.primaryColor,
  };
}

function settingsPoliciesToJson(input: {
  readonly candidatePolicy: CandidatePolicySettings;
  readonly invitationPolicy: InvitationPolicySettings;
  readonly schedulingPolicy: SchedulingPolicySettings;
  readonly flags: Prisma.JsonObject;
}): Prisma.InputJsonObject {
  return {
    schemaVersion: 1,
    candidatePolicy: {
      duplicateCandidateMode: input.candidatePolicy.duplicateCandidateMode,
      allowEmailLessCandidates: input.candidatePolicy.allowEmailLessCandidates,
    },
    invitationPolicy: {
      defaultExpirationDays: input.invitationPolicy.defaultExpirationDays,
      minimumExpirationHours: input.invitationPolicy.minimumExpirationHours,
      maximumExpirationDays: input.invitationPolicy.maximumExpirationDays,
    },
    schedulingPolicy: {
      defaultTimeZone: input.schedulingPolicy.defaultTimeZone,
      allowExternalCalendarSync: input.schedulingPolicy.allowExternalCalendarSync,
    },
    flags: input.flags,
  };
}

function mapCompanySettings(record: PrismaCompanySettings): CompanySettingsRecord {
  const policyRoot = readObject(record.featureFlagsJson);

  return {
    id: record.id,
    companyId: record.companyId as TenantId,
    branding: readBranding(record.brandingJson),
    candidatePolicy: readCandidatePolicy(policyRoot.candidatePolicy),
    invitationPolicy: readInvitationPolicy(policyRoot.invitationPolicy),
    schedulingPolicy: readSchedulingPolicy(policyRoot.schedulingPolicy),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function readBranding(value: Prisma.JsonValue): BrandingSettings {
  const object = readObject(value);
  return {
    ...defaultBrandingSettings(),
    displayName: readNullableString(object.displayName),
    logoUrl: readNullableString(object.logoUrl),
    primaryColor:
      typeof object.primaryColor === "string"
        ? object.primaryColor
        : defaultBrandingSettings().primaryColor,
  };
}

function readCandidatePolicy(value: Prisma.JsonValue | undefined): CandidatePolicySettings {
  const object = readObject(value);
  return {
    ...defaultCandidatePolicySettings(),
    duplicateCandidateMode:
      typeof object.duplicateCandidateMode === "boolean"
        ? object.duplicateCandidateMode
        : defaultCandidatePolicySettings().duplicateCandidateMode,
    allowEmailLessCandidates:
      typeof object.allowEmailLessCandidates === "boolean"
        ? object.allowEmailLessCandidates
        : defaultCandidatePolicySettings().allowEmailLessCandidates,
  };
}

function readInvitationPolicy(value: Prisma.JsonValue | undefined): InvitationPolicySettings {
  const object = readObject(value);
  return {
    ...defaultInvitationPolicySettings(),
    defaultExpirationDays:
      typeof object.defaultExpirationDays === "number"
        ? object.defaultExpirationDays
        : defaultInvitationPolicySettings().defaultExpirationDays,
    minimumExpirationHours:
      typeof object.minimumExpirationHours === "number"
        ? object.minimumExpirationHours
        : defaultInvitationPolicySettings().minimumExpirationHours,
    maximumExpirationDays:
      typeof object.maximumExpirationDays === "number"
        ? object.maximumExpirationDays
        : defaultInvitationPolicySettings().maximumExpirationDays,
  };
}

function readSchedulingPolicy(value: Prisma.JsonValue | undefined): SchedulingPolicySettings {
  const object = readObject(value);
  return {
    ...defaultSchedulingPolicySettings(),
    defaultTimeZone:
      typeof object.defaultTimeZone === "string"
        ? object.defaultTimeZone
        : defaultSchedulingPolicySettings().defaultTimeZone,
    allowExternalCalendarSync:
      typeof object.allowExternalCalendarSync === "boolean"
        ? object.allowExternalCalendarSync
        : defaultSchedulingPolicySettings().allowExternalCalendarSync,
  };
}

function readObject(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

function readNullableString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
