import { describe, expect, it } from "vitest";

import { AuditWriter } from "@/modules/audit";
import {
  hashMagicLinkToken,
  InvitationsDomainError,
  InvitationsService,
} from "@/modules/invitations";
import { createTenantContext } from "@/modules/tenant";

import type { AuditEventStore, PersistedAuditEventInput } from "@/modules/audit";
import type { CandidateApplicationId, CandidateId } from "@/modules/candidates";
import type {
  CandidateInvitationId,
  CandidateInvitationRecord,
  InterviewSessionId,
  InterviewSessionRecord,
  InvitationsRepository,
} from "@/modules/invitations";
import type { InterviewPlanVersionId, JobId } from "@/modules/jobs";
import type { CompanyUserId, TenantContext, TenantId } from "@/modules/tenant";

const tenant = createTenantContext("cm0tenant001");
const otherTenant = createTenantContext("cm0tenant002");
const actor = { type: "user" as const, id: "user-1" as CompanyUserId };
const request = {
  requestId: "req-1",
  correlationId: "corr-1",
  sessionId: "sess-1",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};
const future = new Date("2099-01-01T00:00:00.000Z");

class RecordingAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];
  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class MemoryInvitationsRepository implements InvitationsRepository {
  public readonly invitations = new Map<string, CandidateInvitationRecord>();
  public readonly sessions = new Map<string, InterviewSessionRecord>();

  public createInvitation(input: Parameters<InvitationsRepository["createInvitation"]>[0]) {
    const invitation: CandidateInvitationRecord = {
      id: `invite-${String(this.invitations.size + 1)}` as CandidateInvitationId,
      companyId: input.companyId,
      candidateId: input.candidateId,
      applicationId: input.applicationId,
      jobId: input.jobId,
      tokenHash: input.tokenHash,
      email: input.email,
      status: "draft",
      expiresAt: input.expiresAt,
      sentAt: null,
      openedAt: null,
      acceptedAt: null,
      cancelledAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.invitations.set(key(input.companyId, invitation.id), invitation);
    return Promise.resolve(invitation);
  }

  public findInvitation(tenantContext: TenantContext, invitationId: CandidateInvitationId) {
    return Promise.resolve(
      this.invitations.get(key(tenantContext.companyId, invitationId)) ?? null,
    );
  }

  public updateInvitationStatus(
    input: Parameters<InvitationsRepository["updateInvitationStatus"]>[0],
  ) {
    const invitation = this.invitations.get(key(input.companyId, input.invitationId));
    if (invitation === undefined) {
      throw new Error("Invitation missing");
    }
    const updated: CandidateInvitationRecord = {
      ...invitation,
      status: input.status,
      sentAt: input.sentAt === undefined ? invitation.sentAt : input.sentAt,
      openedAt: input.openedAt === undefined ? invitation.openedAt : input.openedAt,
      acceptedAt: input.acceptedAt === undefined ? invitation.acceptedAt : input.acceptedAt,
      cancelledAt: input.cancelledAt === undefined ? invitation.cancelledAt : input.cancelledAt,
      updatedAt: now(),
    };
    this.invitations.set(key(input.companyId, input.invitationId), updated);
    return Promise.resolve(updated);
  }

  public createInterviewSession(
    input: Parameters<InvitationsRepository["createInterviewSession"]>[0],
  ) {
    const session: InterviewSessionRecord = {
      id: `session-${String(this.sessions.size + 1)}` as InterviewSessionId,
      companyId: input.companyId,
      candidateId: input.candidateId,
      invitationId: input.invitationId,
      applicationId: input.applicationId,
      interviewPlanVersionId: input.interviewPlanVersionId,
      status: "not_started",
      startedAt: null,
      completedAt: null,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
      createdAt: now(),
      updatedAt: now(),
    };
    this.sessions.set(key(input.companyId, session.id), session);
    return Promise.resolve(session);
  }

  public findInterviewSession(tenantContext: TenantContext, sessionId: InterviewSessionId) {
    return Promise.resolve(this.sessions.get(key(tenantContext.companyId, sessionId)) ?? null);
  }

  public updateInterviewSessionStatus(
    input: Parameters<InvitationsRepository["updateInterviewSessionStatus"]>[0],
  ) {
    const session = this.sessions.get(key(input.companyId, input.sessionId));
    if (session === undefined) {
      throw new Error("Session missing");
    }
    const updated: InterviewSessionRecord = {
      ...session,
      status: input.status,
      startedAt: input.startedAt === undefined ? session.startedAt : input.startedAt,
      completedAt: input.completedAt === undefined ? session.completedAt : input.completedAt,
      updatedAt: now(),
    };
    this.sessions.set(key(input.companyId, input.sessionId), updated);
    return Promise.resolve(updated);
  }
}

describe("invitation domain", () => {
  it("creates invitations with hashed tokens only in persistence", async () => {
    const auditStore = new RecordingAuditStore();
    const repository = new MemoryInvitationsRepository();
    const service = new InvitationsService(repository, new AuditWriter(auditStore));

    const result = await service.createInvitation({
      context: { tenant, actor, request },
      candidateId: "candidate-1" as CandidateId,
      applicationId: "application-1" as CandidateApplicationId,
      jobId: "job-1" as JobId,
      email: "CANDIDATE@EXAMPLE.COM",
      expiresAt: future,
    });

    expect(result.invitation).toMatchObject({
      email: "candidate@example.com",
      status: "draft",
      tokenHash: hashMagicLinkToken(result.token),
    });
    expect(result.invitation.tokenHash).not.toBe(result.token);
    expect(auditStore.events[0]?.action).toBe("invitations.invitation_created");
  });

  it("protects invitation lookup by tenant before creating sessions", async () => {
    const repository = new MemoryInvitationsRepository();
    const service = new InvitationsService(repository, new AuditWriter(new RecordingAuditStore()));
    const invitation = await repository.createInvitation({
      companyId: otherTenant.companyId,
      candidateId: "candidate-1" as CandidateId,
      applicationId: null,
      jobId: "job-1" as JobId,
      tokenHash: "hash",
      email: "candidate@example.com",
      expiresAt: future,
    });

    await expect(
      service.createSession({
        context: { tenant, actor, request },
        invitationId: invitation.id,
        expiresAt: future,
      }),
    ).rejects.toBeInstanceOf(InvitationsDomainError);
  });

  it("creates sessions and enforces lifecycle transitions", async () => {
    const repository = new MemoryInvitationsRepository();
    const service = new InvitationsService(repository, new AuditWriter(new RecordingAuditStore()));
    const { invitation } = await service.createInvitation({
      context: { tenant, actor, request },
      candidateId: "candidate-1" as CandidateId,
      jobId: "job-1" as JobId,
      email: "candidate@example.com",
      expiresAt: future,
    });

    const session = await service.createSession({
      context: { tenant, actor, request },
      invitationId: invitation.id,
      interviewPlanVersionId: "version-1" as InterviewPlanVersionId,
      expiresAt: future,
    });
    const ready = await service.transitionSession({
      context: { tenant, actor, request },
      sessionId: session.id,
      status: "ready_check",
    });
    const started = await service.transitionSession({
      context: { tenant, actor, request },
      sessionId: session.id,
      status: "in_progress",
    });

    expect(ready.status).toBe("ready_check");
    expect(started.startedAt).toBeInstanceOf(Date);
    await expect(
      service.transitionSession({
        context: { tenant, actor, request },
        sessionId: session.id,
        status: "ready_check",
      }),
    ).rejects.toBeInstanceOf(InvitationsDomainError);
  });
});

function now(): Date {
  return new Date("2026-06-30T00:00:00.000Z");
}

function key(companyId: TenantId, id: string): string {
  return `${companyId}:${id}`;
}
