import type { AuditActor, AuditRequestContext } from "@/modules/audit";
import type { CandidateSessionContext, CandidateSessionId } from "@/modules/candidate-portal";
import type { CandidateInvitationId, InterviewSessionId } from "@/modules/invitations";
import type { MediaObjectId } from "@/modules/media";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { ProcessingWorkflowId } from "@/modules/workflows";
import type { Brand } from "@/shared";

export type InterviewQuestionStateId = Brand<string, "InterviewQuestionStateId">;
export type InterviewTurnId = Brand<string, "InterviewTurnId">;
export type InterviewTurnMediaId = Brand<string, "InterviewTurnMediaId">;
export type InterviewRecoveryCheckpointId = Brand<string, "InterviewRecoveryCheckpointId">;

export const interviewSessionStatuses = [
  "not_started",
  "ready_check",
  "ready",
  "in_progress",
  "interrupted",
  "upload_recovery",
  "completed",
  "processing",
  "cancelled",
  "expired",
  "withdrawn",
] as const;

export type InterviewSessionStatus = (typeof interviewSessionStatuses)[number];
export type InterviewQuestionKind = "opening" | "main" | "closing" | "follow_up";
export type InterviewQuestionStatus = "pending" | "active" | "answered" | "skipped";
export type InterviewTurnSpeaker = "interviewer" | "candidate" | "system";
export type InterviewTurnStatus =
  "started" | "completed" | "retry_requested" | "superseded" | "cancelled";
export type InterviewTurnMediaStatus = "pending" | "uploaded" | "verified" | "failed";
export type InterviewActivityType =
  | "heartbeat"
  | "connection_lost"
  | "connection_restored"
  | "interrupted"
  | "resumed"
  | "upload_recovery_started";
export type InterviewRecoveryType = "session" | "interruption" | "upload";
export type InterviewRecoveryStatus = "open" | "resolved" | "expired";

export interface InterviewMutationContext {
  readonly tenant: TenantContext;
  readonly actor: AuditActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface CandidateInterviewContext {
  readonly session: CandidateSessionContext;
  readonly request: AuditRequestContext;
}

export interface CandidateSafeQuestion {
  readonly sequence: number;
  readonly key: string;
  readonly kind: InterviewQuestionKind;
  readonly prompt: string;
  readonly required: boolean;
}

export interface CandidateSafePlan {
  readonly versionId: string;
  readonly versionNumber: number;
  readonly durationMinutes: number;
  readonly questions: readonly CandidateSafeQuestion[];
}

export interface InterviewSessionRecord {
  readonly id: InterviewSessionId;
  readonly companyId: TenantId;
  readonly candidateId: string;
  readonly invitationId: CandidateInvitationId;
  readonly applicationId: string | null;
  readonly interviewPlanVersionId: string | null;
  readonly status: InterviewSessionStatus;
  readonly startedAt: Date | null;
  readonly interruptedAt: Date | null;
  readonly completedAt: Date | null;
  readonly lastActivityAt: Date | null;
  readonly durationSeconds: number | null;
  readonly currentQuestionSequence: number | null;
  readonly resumeAllowedUntil: Date | null;
  readonly processingWorkflowId: ProcessingWorkflowId | null;
  readonly planSnapshot: CandidateSafePlan | null;
  readonly expiresAt: Date;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface InterviewQuestionStateRecord {
  readonly id: InterviewQuestionStateId;
  readonly companyId: TenantId;
  readonly interviewSessionId: InterviewSessionId;
  readonly sequence: number;
  readonly questionKey: string;
  readonly kind: InterviewQuestionKind;
  readonly prompt: string;
  readonly required: boolean;
  readonly status: InterviewQuestionStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly metadata: Record<string, unknown>;
}

export interface InterviewTurnRecord {
  readonly id: InterviewTurnId;
  readonly companyId: TenantId;
  readonly interviewSessionId: InterviewSessionId;
  readonly questionStateId: InterviewQuestionStateId;
  readonly sequence: number;
  readonly attemptNumber: number;
  readonly speaker: InterviewTurnSpeaker;
  readonly status: InterviewTurnStatus;
  readonly content: string | null;
  readonly idempotencyKey: string;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly confirmedAt: Date | null;
  readonly metadata: Record<string, unknown>;
}

export interface InterviewTurnMediaRecord {
  readonly id: InterviewTurnMediaId;
  readonly companyId: TenantId;
  readonly interviewSessionId: InterviewSessionId;
  readonly interviewTurnId: InterviewTurnId;
  readonly mediaObjectId: MediaObjectId;
  readonly chunkSequence: number;
  readonly durationMs: number | null;
  readonly status: InterviewTurnMediaStatus;
  readonly metadata: Record<string, unknown>;
}

export interface InterviewStateView {
  readonly session: InterviewSessionRecord;
  readonly plan: CandidateSafePlan;
  readonly questions: readonly InterviewQuestionStateRecord[];
  readonly turns: readonly InterviewTurnRecord[];
  readonly media: readonly InterviewTurnMediaRecord[];
}

export interface InterviewStartResult extends InterviewStateView {
  readonly created: boolean;
}

export interface InterviewRepository {
  findSession(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<InterviewSessionRecord | null>;

  findSessionForCandidate(input: {
    readonly session: CandidateSessionContext;
  }): Promise<InterviewSessionRecord | null>;

  assertCandidatePrepared(session: CandidateSessionContext): Promise<void>;

  startSession(input: {
    readonly session: CandidateSessionContext;
    readonly plan: CandidateSafePlan;
    readonly now: Date;
    readonly resumeAllowedUntil: Date;
  }): Promise<{ readonly session: InterviewSessionRecord; readonly created: boolean }>;

  updateSessionStatus(input: {
    readonly tenant: TenantContext;
    readonly sessionId: InterviewSessionId;
    readonly fromStatuses: readonly InterviewSessionStatus[];
    readonly toStatus: InterviewSessionStatus;
    readonly at: Date;
    readonly currentQuestionSequence?: number | null;
    readonly resumeAllowedUntil?: Date | null;
    readonly processingWorkflowId?: ProcessingWorkflowId | null;
  }): Promise<InterviewSessionRecord | null>;

  loadCandidateSafePlan(input: {
    readonly session: CandidateSessionContext;
  }): Promise<CandidateSafePlan>;

  ensureQuestionStates(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly questions: readonly CandidateSafeQuestion[];
  }): Promise<readonly InterviewQuestionStateRecord[]>;

  listQuestionStates(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<readonly InterviewQuestionStateRecord[]>;

  updateQuestionStatus(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly sequence: number;
    readonly fromStatuses: readonly InterviewQuestionStatus[];
    readonly toStatus: InterviewQuestionStatus;
    readonly at: Date;
  }): Promise<InterviewQuestionStateRecord | null>;

  findTurnByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<InterviewTurnRecord | null>;

  createTurn(input: {
    readonly companyId: TenantId;
    readonly interviewSessionId: InterviewSessionId;
    readonly questionStateId: InterviewQuestionStateId;
    readonly sequence: number;
    readonly attemptNumber: number;
    readonly speaker: InterviewTurnSpeaker;
    readonly idempotencyKey: string;
    readonly startedAt: Date;
    readonly metadata: Record<string, unknown>;
  }): Promise<InterviewTurnRecord>;

  completeTurn(input: {
    readonly tenant: TenantContext;
    readonly turnId: InterviewTurnId;
    readonly content: string | null;
    readonly endedAt: Date;
    readonly metadata: Record<string, unknown>;
  }): Promise<InterviewTurnRecord | null>;

  listTurns(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<readonly InterviewTurnRecord[]>;

  attachTurnMedia(input: {
    readonly companyId: TenantId;
    readonly interviewSessionId: InterviewSessionId;
    readonly turnId: InterviewTurnId;
    readonly mediaObjectId: MediaObjectId;
    readonly chunkSequence: number;
    readonly durationMs: number | null;
    readonly status: InterviewTurnMediaStatus;
    readonly metadata: Record<string, unknown>;
  }): Promise<InterviewTurnMediaRecord>;

  listTurnMedia(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<readonly InterviewTurnMediaRecord[]>;

  hasUnverifiedRequiredMedia(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<boolean>;

  recordActivity(input: {
    readonly companyId: TenantId;
    readonly interviewSessionId: InterviewSessionId;
    readonly candidateSessionId: CandidateSessionId | null;
    readonly type: InterviewActivityType;
    readonly at: Date;
    readonly metadata: Record<string, unknown>;
  }): Promise<void>;

  createRecoveryCheckpoint(input: {
    readonly companyId: TenantId;
    readonly interviewSessionId: InterviewSessionId;
    readonly candidateSessionId: CandidateSessionId | null;
    readonly type: InterviewRecoveryType;
    readonly checkpoint: Record<string, unknown>;
    readonly expiresAt: Date;
  }): Promise<InterviewRecoveryCheckpointId>;

  resolveRecoveryCheckpoints(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly type?: InterviewRecoveryType;
    readonly resolvedAt: Date;
  }): Promise<void>;

  listOpenRecoveryCheckpoints(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<
    readonly {
      readonly id: InterviewRecoveryCheckpointId;
      readonly type: InterviewRecoveryType;
      readonly checkpoint: Record<string, unknown>;
      readonly expiresAt: Date;
    }[]
  >;

  recordStateHistory(input: {
    readonly companyId: TenantId;
    readonly interviewSessionId: InterviewSessionId;
    readonly fromStatus: InterviewSessionStatus | null;
    readonly toStatus: InterviewSessionStatus;
    readonly reason: string | null;
    readonly metadata: Record<string, unknown>;
  }): Promise<void>;

  markCandidateSessionInterview(input: {
    readonly session: CandidateSessionContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<void>;
}
