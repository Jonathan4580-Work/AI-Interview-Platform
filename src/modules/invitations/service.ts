import { createHash, randomBytes } from "node:crypto";

import { AuditWriter } from "@/modules/audit";

import type {
  CandidateInvitationId,
  CreateInvitationResult,
  InterviewSessionId,
  InterviewSessionRecord,
  InvitationMutationContext,
  InvitationsRepository,
} from "./types";
import type { CandidateApplicationId, CandidateId } from "@/modules/candidates";
import type { InterviewPlanVersionId, JobId } from "@/modules/jobs";

export class InvitationsDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvitationsDomainError";
  }
}

export class InvitationsService {
  public constructor(
    private readonly repository: InvitationsRepository,
    private readonly auditWriter: AuditWriter,
  ) {}

  public async createInvitation(input: {
    readonly context: InvitationMutationContext;
    readonly candidateId: CandidateId;
    readonly applicationId?: CandidateApplicationId | null;
    readonly jobId: JobId;
    readonly email: string;
    readonly expiresAt: Date;
  }): Promise<CreateInvitationResult> {
    assertFuture(input.expiresAt, "Invitation expiration");
    const token = generateMagicLinkToken();
    const invitation = await this.repository.createInvitation({
      companyId: input.context.tenant.companyId,
      candidateId: input.candidateId,
      applicationId: input.applicationId ?? null,
      jobId: input.jobId,
      tokenHash: hashMagicLinkToken(token),
      email: normalizeEmail(input.email),
      expiresAt: input.expiresAt,
    });

    await this.writeAudit(
      input.context,
      "invitations.invitation_created",
      "candidate_invitation",
      invitation.id,
      {
        after: { ...invitation, tokenHash: "[redacted]" },
      },
    );
    return { invitation, token };
  }

  public async markQueued(input: {
    readonly context: InvitationMutationContext;
    readonly invitationId: CandidateInvitationId;
  }) {
    const existing = await this.requireInvitation(input.context, input.invitationId);
    if (existing.status !== "draft") {
      throw new InvitationsDomainError("Only draft invitations can be queued.");
    }
    return this.transitionInvitation(
      input.context,
      input.invitationId,
      "queued",
      "invitations.invitation_queued",
    );
  }

  public async markSent(input: {
    readonly context: InvitationMutationContext;
    readonly invitationId: CandidateInvitationId;
  }) {
    const existing = await this.requireInvitation(input.context, input.invitationId);
    if (existing.status !== "queued" && existing.status !== "draft") {
      throw new InvitationsDomainError("Only draft or queued invitations can be marked sent.");
    }
    return this.transitionInvitation(
      input.context,
      input.invitationId,
      "sent",
      "invitations.invitation_sent",
      {
        sentAt: new Date(),
      },
    );
  }

  public async cancelInvitation(input: {
    readonly context: InvitationMutationContext;
    readonly invitationId: CandidateInvitationId;
  }) {
    const existing = await this.requireInvitation(input.context, input.invitationId);
    if (existing.status === "accepted" || existing.status === "expired") {
      throw new InvitationsDomainError("Accepted or expired invitations cannot be cancelled.");
    }
    return this.transitionInvitation(
      input.context,
      input.invitationId,
      "cancelled",
      "invitations.invitation_cancelled",
      {
        cancelledAt: new Date(),
      },
    );
  }

  public async createSession(input: {
    readonly context: InvitationMutationContext;
    readonly invitationId: CandidateInvitationId;
    readonly interviewPlanVersionId?: InterviewPlanVersionId | null;
    readonly expiresAt: Date;
    readonly metadata?: Record<string, unknown>;
  }): Promise<InterviewSessionRecord> {
    assertFuture(input.expiresAt, "Interview session expiration");
    const invitation = await this.requireInvitation(input.context, input.invitationId);
    if (invitation.status === "cancelled" || invitation.status === "expired") {
      throw new InvitationsDomainError("Cancelled or expired invitations cannot create sessions.");
    }

    const session = await this.repository.createInterviewSession({
      companyId: input.context.tenant.companyId,
      candidateId: invitation.candidateId,
      invitationId: invitation.id,
      applicationId: invitation.applicationId,
      interviewPlanVersionId: input.interviewPlanVersionId ?? null,
      expiresAt: input.expiresAt,
      metadata: input.metadata ?? {},
    });
    await this.repository.updateInvitationStatus({
      companyId: input.context.tenant.companyId,
      invitationId: invitation.id,
      status: "accepted",
      acceptedAt: new Date(),
    });

    await this.writeAudit(
      input.context,
      "invitations.session_created",
      "interview_session",
      session.id,
      {
        after: session,
      },
    );
    return session;
  }

  public async transitionSession(input: {
    readonly context: InvitationMutationContext;
    readonly sessionId: InterviewSessionId;
    readonly status: InterviewSessionRecord["status"];
  }): Promise<InterviewSessionRecord> {
    const session = await this.requireSession(input.context, input.sessionId);
    assertSessionTransition(session.status, input.status);
    const transitioned = await this.repository.updateInterviewSessionStatus({
      companyId: input.context.tenant.companyId,
      sessionId: input.sessionId,
      status: input.status,
      startedAt: input.status === "in_progress" ? (session.startedAt ?? new Date()) : undefined,
      completedAt: input.status === "completed" ? new Date() : undefined,
    });
    await this.writeAudit(
      input.context,
      "invitations.session_status_changed",
      "interview_session",
      transitioned.id,
      {
        before: session,
        after: transitioned,
      },
    );
    return transitioned;
  }

  private async requireInvitation(
    context: InvitationMutationContext,
    invitationId: CandidateInvitationId,
  ) {
    const invitation = await this.repository.findInvitation(context.tenant, invitationId);
    if (invitation === null) {
      throw new InvitationsDomainError("Invitation was not found for this company.");
    }
    if (invitation.expiresAt <= new Date() && invitation.status !== "expired") {
      throw new InvitationsDomainError("Invitation has expired.");
    }
    return invitation;
  }

  private async requireSession(
    context: InvitationMutationContext,
    sessionId: InterviewSessionId,
  ): Promise<InterviewSessionRecord> {
    const session = await this.repository.findInterviewSession(context.tenant, sessionId);
    if (session === null) {
      throw new InvitationsDomainError("Interview session was not found for this company.");
    }
    if (session.expiresAt <= new Date() && session.status !== "expired") {
      throw new InvitationsDomainError("Interview session has expired.");
    }
    return session;
  }

  private async transitionInvitation(
    context: InvitationMutationContext,
    invitationId: CandidateInvitationId,
    status: Parameters<InvitationsRepository["updateInvitationStatus"]>[0]["status"],
    action: string,
    timestamps: Omit<
      Parameters<InvitationsRepository["updateInvitationStatus"]>[0],
      "companyId" | "invitationId" | "status"
    > = {},
  ) {
    const invitation = await this.repository.updateInvitationStatus({
      companyId: context.tenant.companyId,
      invitationId,
      status,
      ...timestamps,
    });
    await this.writeAudit(context, action, "candidate_invitation", invitation.id, {
      after: { ...invitation, tokenHash: "[redacted]" },
    });
    return invitation;
  }

  private async writeAudit(
    context: InvitationMutationContext,
    action: string,
    resourceType: string,
    resourceId: string,
    snapshots: { readonly before?: unknown; readonly after?: unknown },
  ): Promise<void> {
    await this.auditWriter.record({
      companyId: context.tenant.companyId,
      actor:
        context.actor.type === "system"
          ? { type: "system", id: null }
          : { type: context.actor.type, id: context.actor.id },
      request: context.request,
      supportAccessSessionId: context.supportAccessSessionId,
      action,
      resourceType,
      resourceId,
      riskLevel: "medium",
      before: snapshots.before,
      after: snapshots.after,
    });
  }
}

export function generateMagicLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashMagicLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new InvitationsDomainError("Invitation email must be valid.");
  }
  return normalized;
}

function assertFuture(value: Date, label: string): void {
  if (value <= new Date()) {
    throw new InvitationsDomainError(`${label} must be in the future.`);
  }
}

function assertSessionTransition(
  from: InterviewSessionRecord["status"],
  to: InterviewSessionRecord["status"],
): void {
  const allowed: Record<
    InterviewSessionRecord["status"],
    readonly InterviewSessionRecord["status"][]
  > = {
    not_started: ["ready_check", "cancelled", "expired"],
    ready_check: ["in_progress", "cancelled", "expired"],
    in_progress: ["completed", "cancelled", "expired"],
    completed: [],
    cancelled: [],
    expired: [],
  };
  if (!allowed[from].includes(to)) {
    throw new InvitationsDomainError(`Interview session cannot transition from ${from} to ${to}.`);
  }
}
