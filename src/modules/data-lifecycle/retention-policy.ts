import type { TenantId } from "@/modules/tenant";

export interface RetentionPolicyRecord {
  readonly companyId: TenantId;
  readonly candidateProfileDays: number;
  readonly invitationDays: number;
  readonly recordingDays: number;
  readonly transcriptDays: number;
  readonly evaluationDays: number;
  readonly reportDays: number;
  readonly auditEventDays: number;
  readonly identityVerificationDays: number;
  readonly supportAccessDays: number;
  readonly privacyRequestDays: number;
  readonly exportRequestDays: number;
}

export const defaultRetentionPolicy = {
  candidateProfileDays: 730,
  invitationDays: 730,
  recordingDays: 180,
  transcriptDays: 365,
  evaluationDays: 365,
  reportDays: 365,
  auditEventDays: 2555,
  identityVerificationDays: 90,
  supportAccessDays: 2555,
  privacyRequestDays: 2555,
  exportRequestDays: 30,
} as const;

export interface RetentionPolicyStore {
  upsertPolicy(policy: RetentionPolicyRecord): Promise<RetentionPolicyRecord>;
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
}
