import type { AuditRequestContext } from "@/modules/audit";
import type { CandidateApplicationId, CandidateId } from "@/modules/candidates";
import type { InterviewPlanVersionId, JobId } from "@/modules/jobs";
import type { CompanyActor, TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type CandidateInvitationId = Brand<string, "CandidateInvitationId">;
export type InterviewSessionId = Brand<string, "InterviewSessionId">;

export type InvitationStatus =
  "draft" | "queued" | "sent" | "opened" | "accepted" | "expired" | "cancelled";
export type InterviewSessionStatus =
  "not_started" | "ready_check" | "in_progress" | "completed" | "cancelled" | "expired";

export interface InvitationMutationContext {
  readonly tenant: TenantContext;
  readonly actor: CompanyActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface CandidateInvitationRecord {
  readonly id: CandidateInvitationId;
  readonly companyId: TenantId;
  readonly candidateId: CandidateId;
  readonly applicationId: CandidateApplicationId | null;
  readonly jobId: JobId;
  readonly tokenHash: string;
  readonly email: string;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly sentAt: Date | null;
  readonly openedAt: Date | null;
  readonly acceptedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateInvitationResult {
  readonly invitation: CandidateInvitationRecord;
  readonly token: string;
}

export interface InterviewSessionRecord {
  readonly id: InterviewSessionId;
  readonly companyId: TenantId;
  readonly candidateId: CandidateId;
  readonly invitationId: CandidateInvitationId;
  readonly applicationId: CandidateApplicationId | null;
  readonly interviewPlanVersionId: InterviewPlanVersionId | null;
  readonly status: InterviewSessionStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly expiresAt: Date;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface InvitationsRepository {
  createInvitation(input: {
    readonly companyId: TenantId;
    readonly candidateId: CandidateId;
    readonly applicationId: CandidateApplicationId | null;
    readonly jobId: JobId;
    readonly tokenHash: string;
    readonly email: string;
    readonly expiresAt: Date;
  }): Promise<CandidateInvitationRecord>;
  findInvitation(
    tenant: TenantContext,
    invitationId: CandidateInvitationId,
  ): Promise<CandidateInvitationRecord | null>;
  updateInvitationStatus(input: {
    readonly companyId: TenantId;
    readonly invitationId: CandidateInvitationId;
    readonly status: InvitationStatus;
    readonly sentAt?: Date | null;
    readonly openedAt?: Date | null;
    readonly acceptedAt?: Date | null;
    readonly cancelledAt?: Date | null;
  }): Promise<CandidateInvitationRecord>;
  createInterviewSession(input: {
    readonly companyId: TenantId;
    readonly candidateId: CandidateId;
    readonly invitationId: CandidateInvitationId;
    readonly applicationId: CandidateApplicationId | null;
    readonly interviewPlanVersionId: InterviewPlanVersionId | null;
    readonly expiresAt: Date;
    readonly metadata: Record<string, unknown>;
  }): Promise<InterviewSessionRecord>;
  findInterviewSession(
    tenant: TenantContext,
    sessionId: InterviewSessionId,
  ): Promise<InterviewSessionRecord | null>;
  updateInterviewSessionStatus(input: {
    readonly companyId: TenantId;
    readonly sessionId: InterviewSessionId;
    readonly status: InterviewSessionStatus;
    readonly startedAt?: Date | null;
    readonly completedAt?: Date | null;
  }): Promise<InterviewSessionRecord>;
}
