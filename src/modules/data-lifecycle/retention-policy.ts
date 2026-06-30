import type { TenantId } from "@/modules/tenant";

export interface RetentionPolicyRecord {
  readonly companyId: TenantId;
  readonly candidateProfileDays: number;
  readonly candidateSessionDays: number;
  readonly consentRecordDays: number;
  readonly invitationDays: number;
  readonly recordingDays: number;
  readonly monitoringEventDays: number;
  readonly transcriptDays: number;
  readonly evaluationDays: number;
  readonly reportDays: number;
  readonly emailDeliveryDays: number;
  readonly analyticsEventDays: number;
  readonly workflowOperationalDays: number;
  readonly auditEventDays: number;
  readonly identityVerificationDays: number;
  readonly supportAccessDays: number;
  readonly privacyRequestDays: number;
  readonly exportRequestDays: number;
}

export const defaultRetentionPolicy = {
  candidateProfileDays: 730,
  candidateSessionDays: 90,
  consentRecordDays: 2555,
  invitationDays: 730,
  recordingDays: 180,
  monitoringEventDays: 365,
  transcriptDays: 365,
  evaluationDays: 365,
  reportDays: 365,
  emailDeliveryDays: 365,
  analyticsEventDays: 730,
  workflowOperationalDays: 180,
  auditEventDays: 2555,
  identityVerificationDays: 90,
  supportAccessDays: 2555,
  privacyRequestDays: 2555,
  exportRequestDays: 30,
} as const;

export interface RetentionPolicyStore {
  upsertPolicy(policy: RetentionPolicyRecord): Promise<RetentionPolicyRecord>;
}

export interface RetentionEligibilityInput {
  readonly retentionDeleteAt: Date;
  readonly now?: Date;
  readonly legalHoldActive?: boolean;
  readonly deletedAt?: Date | null;
}

export class RetentionPolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RetentionPolicyError";
  }
}

export function createRetentionPolicyRecord(
  companyId: TenantId,
  overrides: Partial<Omit<RetentionPolicyRecord, "companyId">> = {},
): RetentionPolicyRecord {
  const policy = {
    companyId,
    ...defaultRetentionPolicy,
    ...overrides,
  };

  assertRetentionPolicy(policy);
  return policy;
}

export function assertRetentionPolicy(policy: RetentionPolicyRecord): void {
  for (const [key, value] of Object.entries(policy)) {
    if (key === "companyId") {
      continue;
    }

    if (!Number.isInteger(value) || value < 0) {
      throw new RetentionPolicyError(`Retention value ${key} must be a non-negative integer.`);
    }
  }

  if (policy.auditEventDays < 365) {
    throw new RetentionPolicyError("Audit event retention must be at least 365 days.");
  }

  if (policy.supportAccessDays < 365) {
    throw new RetentionPolicyError("Support access retention must be at least 365 days.");
  }

  if (policy.consentRecordDays < 365) {
    throw new RetentionPolicyError("Consent record retention must be at least 365 days.");
  }
}

export function calculateRetentionDeleteAt(anchor: Date, retentionDays: number): Date {
  if (!Number.isInteger(retentionDays) || retentionDays < 0) {
    throw new RetentionPolicyError("Retention days must be a non-negative integer.");
  }

  return new Date(anchor.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

export function isRetentionDeletionEligible(input: RetentionEligibilityInput): boolean {
  if (input.deletedAt !== undefined && input.deletedAt !== null) {
    return false;
  }
  if (input.legalHoldActive === true) {
    return false;
  }

  return input.retentionDeleteAt.getTime() <= (input.now ?? new Date()).getTime();
}
