import { AuditWriter } from "@/modules/audit";

import type {
  BrandingSettings,
  CandidatePolicySettings,
  CompanySettingsRecord,
  CompanySettingsRepository,
  InvitationPolicySettings,
  SchedulingPolicySettings,
  UpdateBrandingInput,
  UpdateCandidatePolicyInput,
  UpdateInvitationPolicyInput,
  UpdateSchedulingPolicyInput,
} from "./company-settings-types";
import type { TenantContext } from "./types";

const hexColorPattern = /^#[0-9a-fA-F]{6}$/u;

export class CompanySettingsError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CompanySettingsError";
  }
}

export class CompanySettingsService {
  public constructor(
    private readonly repository: CompanySettingsRepository,
    private readonly audit: AuditWriter,
  ) {}

  public async getSettings(tenant: TenantContext): Promise<CompanySettingsRecord> {
    const existing = await this.repository.findByTenant(tenant);
    if (existing !== null) {
      return existing;
    }

    return this.repository.upsert({
      companyId: tenant.companyId,
      branding: defaultBrandingSettings(),
      candidatePolicy: defaultCandidatePolicySettings(),
      invitationPolicy: defaultInvitationPolicySettings(),
      schedulingPolicy: defaultSchedulingPolicySettings(),
    });
  }

  public async updateBranding(input: UpdateBrandingInput): Promise<CompanySettingsRecord> {
    const before = await this.getSettings(input.tenant);
    const branding = normalizeBranding({
      schemaVersion: 1,
      displayName: normalizeOptionalText(input.displayName ?? null, 160),
      logoUrl: normalizeOptionalHttpsUrl(input.logoUrl ?? null),
      primaryColor: input.primaryColor,
    });

    const updated = await this.repository.upsert({
      companyId: input.tenant.companyId,
      branding,
      candidatePolicy: before.candidatePolicy,
      invitationPolicy: before.invitationPolicy,
      schedulingPolicy: before.schedulingPolicy,
    });

    await this.auditSettingsChange(input, "company_settings.branding_updated", before, updated);
    return updated;
  }

  public async updateCandidatePolicy(
    input: UpdateCandidatePolicyInput,
  ): Promise<CompanySettingsRecord> {
    const before = await this.getSettings(input.tenant);
    const candidatePolicy: CandidatePolicySettings = {
      schemaVersion: 1,
      duplicateCandidateMode: input.duplicateCandidateMode,
      allowEmailLessCandidates: input.allowEmailLessCandidates,
    };

    const updated = await this.repository.upsert({
      companyId: input.tenant.companyId,
      branding: before.branding,
      candidatePolicy,
      invitationPolicy: before.invitationPolicy,
      schedulingPolicy: before.schedulingPolicy,
    });

    await this.auditSettingsChange(
      input,
      "company_settings.candidate_policy_updated",
      before,
      updated,
    );
    return updated;
  }

  public async updateInvitationPolicy(
    input: UpdateInvitationPolicyInput,
  ): Promise<CompanySettingsRecord> {
    const before = await this.getSettings(input.tenant);
    const invitationPolicy = normalizeInvitationPolicy({
      schemaVersion: 1,
      defaultExpirationDays: input.defaultExpirationDays,
      minimumExpirationHours: input.minimumExpirationHours,
      maximumExpirationDays: input.maximumExpirationDays,
    });

    const updated = await this.repository.upsert({
      companyId: input.tenant.companyId,
      branding: before.branding,
      candidatePolicy: before.candidatePolicy,
      invitationPolicy,
      schedulingPolicy: before.schedulingPolicy,
    });

    await this.auditSettingsChange(
      input,
      "company_settings.invitation_policy_updated",
      before,
      updated,
    );
    return updated;
  }

  public async updateSchedulingPolicy(
    input: UpdateSchedulingPolicyInput,
  ): Promise<CompanySettingsRecord> {
    const before = await this.getSettings(input.tenant);
    const schedulingPolicy = normalizeSchedulingPolicy({
      schemaVersion: 1,
      defaultTimeZone: input.defaultTimeZone,
      allowExternalCalendarSync: input.allowExternalCalendarSync,
    });

    const updated = await this.repository.upsert({
      companyId: input.tenant.companyId,
      branding: before.branding,
      candidatePolicy: before.candidatePolicy,
      invitationPolicy: before.invitationPolicy,
      schedulingPolicy,
    });

    await this.auditSettingsChange(
      input,
      "company_settings.scheduling_policy_updated",
      before,
      updated,
    );
    return updated;
  }

  private async auditSettingsChange(
    input:
      | UpdateBrandingInput
      | UpdateCandidatePolicyInput
      | UpdateInvitationPolicyInput
      | UpdateSchedulingPolicyInput,
    action: string,
    before: CompanySettingsRecord,
    after: CompanySettingsRecord,
  ): Promise<void> {
    await this.audit.record({
      companyId: input.tenant.companyId,
      actor: input.actor,
      request: input.request,
      supportAccessSessionId: input.supportAccessSessionId ?? null,
      action,
      resourceType: "company_settings",
      resourceId: before.id,
      riskLevel: "medium",
      before,
      after,
    });
  }
}

export function defaultBrandingSettings(): BrandingSettings {
  return {
    schemaVersion: 1,
    displayName: null,
    logoUrl: null,
    primaryColor: "#2563EB",
  };
}

export function defaultCandidatePolicySettings(): CandidatePolicySettings {
  return {
    schemaVersion: 1,
    duplicateCandidateMode: false,
    allowEmailLessCandidates: false,
  };
}

export function defaultInvitationPolicySettings(): InvitationPolicySettings {
  return {
    schemaVersion: 1,
    defaultExpirationDays: 7,
    minimumExpirationHours: 1,
    maximumExpirationDays: 30,
  };
}

export function defaultSchedulingPolicySettings(): SchedulingPolicySettings {
  return {
    schemaVersion: 1,
    defaultTimeZone: "UTC",
    allowExternalCalendarSync: false,
  };
}

function normalizeBranding(input: BrandingSettings): BrandingSettings {
  if (!hexColorPattern.test(input.primaryColor)) {
    throw new CompanySettingsError("Branding primary color must be a six-digit hex color.");
  }

  return input;
}

function normalizeInvitationPolicy(input: InvitationPolicySettings): InvitationPolicySettings {
  if (!Number.isInteger(input.minimumExpirationHours) || input.minimumExpirationHours < 1) {
    throw new CompanySettingsError("Invitation minimum expiration must be at least one hour.");
  }

  if (!Number.isInteger(input.maximumExpirationDays) || input.maximumExpirationDays > 90) {
    throw new CompanySettingsError("Invitation maximum expiration cannot exceed 90 days.");
  }

  if (
    !Number.isInteger(input.defaultExpirationDays) ||
    input.defaultExpirationDays < 1 ||
    input.defaultExpirationDays > input.maximumExpirationDays
  ) {
    throw new CompanySettingsError("Invitation default expiration is outside policy bounds.");
  }

  return input;
}

function normalizeSchedulingPolicy(input: SchedulingPolicySettings): SchedulingPolicySettings {
  try {
    Intl.DateTimeFormat(undefined, {
      timeZone: input.defaultTimeZone,
    });
  } catch {
    throw new CompanySettingsError("Default scheduling time zone is invalid.");
  }

  return input;
}

function normalizeOptionalText(value: string | null, maxLength: number): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new CompanySettingsError("Text value exceeds maximum length.");
  }

  return normalized;
}

function normalizeOptionalHttpsUrl(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") {
      throw new CompanySettingsError("URL must use HTTPS.");
    }
    return url.toString();
  } catch (error) {
    if (error instanceof CompanySettingsError) {
      throw error;
    }
    throw new CompanySettingsError("URL is invalid.");
  }
}
