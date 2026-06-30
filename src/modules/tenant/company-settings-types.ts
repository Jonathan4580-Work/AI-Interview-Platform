import type { CompanyMutationContext } from "./company-types";
import type { TenantContext, TenantId } from "./types";

export interface BrandingSettings {
  readonly schemaVersion: 1;
  readonly displayName: string | null;
  readonly logoUrl: string | null;
  readonly primaryColor: string;
}

export interface CandidatePolicySettings {
  readonly schemaVersion: 1;
  readonly duplicateCandidateMode: boolean;
  readonly allowEmailLessCandidates: boolean;
}

export interface InvitationPolicySettings {
  readonly schemaVersion: 1;
  readonly defaultExpirationDays: number;
  readonly minimumExpirationHours: number;
  readonly maximumExpirationDays: number;
}

export interface SchedulingPolicySettings {
  readonly schemaVersion: 1;
  readonly defaultTimeZone: string;
  readonly allowExternalCalendarSync: boolean;
}

export interface CompanySettingsRecord {
  readonly id: string;
  readonly companyId: TenantId;
  readonly branding: BrandingSettings;
  readonly candidatePolicy: CandidatePolicySettings;
  readonly invitationPolicy: InvitationPolicySettings;
  readonly schedulingPolicy: SchedulingPolicySettings;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpdateBrandingInput extends CompanyMutationContext {
  readonly displayName?: string | null;
  readonly logoUrl?: string | null;
  readonly primaryColor: string;
}

export interface UpdateCandidatePolicyInput extends CompanyMutationContext {
  readonly duplicateCandidateMode: boolean;
  readonly allowEmailLessCandidates: boolean;
}

export interface UpdateInvitationPolicyInput extends CompanyMutationContext {
  readonly defaultExpirationDays: number;
  readonly minimumExpirationHours: number;
  readonly maximumExpirationDays: number;
}

export interface UpdateSchedulingPolicyInput extends CompanyMutationContext {
  readonly defaultTimeZone: string;
  readonly allowExternalCalendarSync: boolean;
}

export interface CompanySettingsRepository {
  findByTenant(tenant: TenantContext): Promise<CompanySettingsRecord | null>;
  upsert(input: {
    readonly companyId: TenantId;
    readonly branding: BrandingSettings;
    readonly candidatePolicy: CandidatePolicySettings;
    readonly invitationPolicy: InvitationPolicySettings;
    readonly schedulingPolicy: SchedulingPolicySettings;
  }): Promise<CompanySettingsRecord>;
}
