import { normalizeEmail } from "@/modules/identity";

import type { TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type PrivacyRequestId = Brand<string, "PrivacyRequestId">;

export const privacyRequestTypes = [
  "access",
  "deletion",
  "anonymization",
  "export",
  "correction",
] as const;

export type PrivacyRequestType = (typeof privacyRequestTypes)[number];

export const privacyRequestStatuses = [
  "received",
  "verifying",
  "processing",
  "completed",
  "denied",
] as const;

export type PrivacyRequestStatus = (typeof privacyRequestStatuses)[number];

export interface PrivacyRequest {
  readonly id: PrivacyRequestId;
  readonly companyId: TenantId;
  readonly candidateId: string | null;
  readonly type: PrivacyRequestType;
  readonly status: PrivacyRequestStatus;
  readonly requesterEmail: string;
  readonly reason: string | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreatePrivacyRequestInput {
  readonly companyId: TenantId;
  readonly candidateId?: string | null;
  readonly type: PrivacyRequestType;
  readonly requesterEmail: string;
  readonly reason?: string | null;
}

export interface PrivacyRequestStore {
  create(input: {
    readonly companyId: TenantId;
    readonly candidateId: string | null;
    readonly type: PrivacyRequestType;
    readonly requesterEmail: string;
    readonly reason: string | null;
  }): Promise<PrivacyRequest>;
}

export class PrivacyRequestError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PrivacyRequestError";
  }
}

export class PrivacyRequestService {
  public constructor(private readonly store: PrivacyRequestStore) {}

  public async create(input: CreatePrivacyRequestInput): Promise<PrivacyRequest> {
    const requesterEmail = normalizeEmail(input.requesterEmail);
    const reason = input.reason?.trim() ?? null;

    if ((input.type === "deletion" || input.type === "anonymization") && reason === null) {
      throw new PrivacyRequestError("Privacy requests that change data require a reason.");
    }

    return this.store.create({
      companyId: input.companyId,
      candidateId: input.candidateId ?? null,
      type: input.type,
      requesterEmail,
      reason,
    });
  }
}
