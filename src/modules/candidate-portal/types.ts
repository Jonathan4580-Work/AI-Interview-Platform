import type { TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type CandidateSessionId = Brand<string, "CandidateSessionId">;
export type CandidateSessionToken = Brand<string, "CandidateSessionToken">;
export type CandidateCsrfToken = Brand<string, "CandidateCsrfToken">;

export type CandidateLinkExchangeResult =
  | {
      readonly ok: true;
      readonly sessionId: CandidateSessionId;
      readonly sessionToken: CandidateSessionToken;
      readonly csrfToken: CandidateCsrfToken;
      readonly expiresAt: Date;
      readonly nextPath: string;
    }
  | {
      readonly ok: false;
      readonly reason: "expired" | "revoked" | "completed" | "in_progress" | "invalid";
    };

export interface CandidateSessionContext {
  readonly companyId: TenantId;
  readonly sessionId: CandidateSessionId;
  readonly candidateId: string;
  readonly invitationId: string;
  readonly interviewSessionId: string | null;
  readonly expiresAt: Date;
  readonly csrfTokenHash: string;
}

export interface CandidateRequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface CandidatePortalStatus {
  readonly sessionId: CandidateSessionId;
  readonly expiresAt: Date;
  readonly invitation: {
    readonly id: string;
    readonly status: string;
    readonly expiresAt: Date;
  };
  readonly candidate: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  };
  readonly job: {
    readonly id: string;
    readonly title: string;
  };
  readonly consents: readonly {
    readonly type: string;
    readonly accepted: boolean;
    readonly consentVersion: string;
    readonly policyVersion: string;
  }[];
  readonly readiness: readonly {
    readonly type: string;
    readonly status: string;
    readonly checkedAt: Date;
  }[];
  readonly identityVerificationStatus: string | null;
  readonly withdrawn: boolean;
}

export interface ReadinessSubmission {
  readonly type:
    | "CAMERA"
    | "MICROPHONE"
    | "BROWSER"
    | "SECURE_CONTEXT"
    | "MEDIA_DEVICES"
    | "NETWORK"
    | "DEVICE"
    | "SCREEN_SIZE"
    | "AUDIO_OUTPUT";
  readonly status: "PASS" | "WARNING" | "FAIL";
  readonly details: Record<string, unknown>;
}
