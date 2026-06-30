import { env } from "@/config";
import { prisma } from "@/infra/database";
import { createQueue } from "@/infra/queue";
import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import { PrismaEmailRepository } from "@/modules/email/prisma-email-repository";
import { DefaultEmailProviderFactory } from "@/modules/email/provider-factory";
import { EmailService } from "@/modules/email/service";
import { normalizeEmail } from "@/modules/email/service";
import { createTenantContext } from "@/modules/tenant";

import {
  createCandidateCsrfToken,
  createCandidateSessionToken,
  createInvitationToken,
  hashCandidateToken,
  hashIpAddress,
  isWellFormedToken,
  timingSafeHashEqual,
  tokenHashPrefix,
} from "./security";

import type {
  CandidateLinkExchangeResult,
  CandidatePortalStatus,
  CandidateRequestContext,
  CandidateSessionContext,
  CandidateSessionId,
  ReadinessSubmission,
} from "./types";
import type {
  CandidateConsentType,
  CandidateTokenAttemptOutcome,
  NotificationIntentType,
  Prisma,
} from "@prisma/client";
import type { AuditActor, AuditRequestContext } from "@/modules/audit";
import type { CompanyActor, TenantContext, TenantId } from "@/modules/tenant";
import type { Queue } from "bullmq";
import type { EmailDeliveryJob } from "@/modules/email";

const DEFAULT_INVITATION_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000;
const MIN_INVITATION_EXPIRY_MS = 60 * 60 * 1000;
const MAX_INVITATION_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;
const RESUME_DURATION_MS = 30 * 60 * 1000;
const CONSENT_VERSION = "candidate-consent-v1";
const PRIVACY_POLICY_VERSION = "privacy-v1";

export class CandidatePortalError extends Error {
  public constructor(
    message: string,
    public readonly code:
      "invalid_link" | "session_required" | "csrf_failed" | "invalid_state" | "validation_failed",
  ) {
    super(message);
    this.name = "CandidatePortalError";
  }
}

export class CandidatePortalService {
  private readonly auditWriter = new AuditWriter(new PrismaAuditEventStore());

  public async activateInvitation(input: {
    readonly tenant: TenantContext;
    readonly actor: CompanyActor;
    readonly request: CandidateRequestContext;
    readonly invitationId: string;
    readonly expiresInHours?: number | null;
    readonly idempotencyKey?: string | null;
  }): Promise<{ readonly invitationId: string; readonly expiresAt: Date }> {
    const expiresAt = computeExpiry(input.expiresInHours ?? null);
    const rawToken = createInvitationToken();
    const tokenHash = hashCandidateToken(rawToken);

    const invitation = await prisma.$transaction(async (tx) => {
      const existing = await tx.candidateInvitation.findUnique({
        where: { companyId_id: { companyId: input.tenant.companyId, id: input.invitationId } },
        include: { candidate: true, job: true },
      });
      if (existing === null) {
        throw new CandidatePortalError("Invitation was not found.", "invalid_state");
      }
      if (existing.status === "ACCEPTED" || existing.status === "EXPIRED") {
        throw new CandidatePortalError("Invitation cannot be activated.", "invalid_state");
      }

      return tx.candidateInvitation.update({
        where: { companyId_id: { companyId: input.tenant.companyId, id: input.invitationId } },
        data: {
          tokenHash,
          tokenConsumedAt: null,
          tokenRevokedAt: null,
          tokenRotatedAt: existing.sentAt === null ? null : new Date(),
          expiresAt,
          status: "QUEUED",
          resendCount: { increment: existing.sentAt === null ? 0 : 1 },
        },
        include: { candidate: true, job: true },
      });
    });

    const tenant = createTenantContext(input.tenant.companyId);
    const context = {
      tenant,
      actor: input.actor,
      request: toAuditRequest(input.request),
    };
    const actionUrl = new URL(
      `/candidate/entry?token=${encodeURIComponent(rawToken)}`,
      env.APP_URL,
    );
    const emailService = new EmailService(
      new PrismaEmailRepository(),
      new DefaultEmailProviderFactory(),
      createQueue("email") as Queue<EmailDeliveryJob>,
      this.auditWriter,
    );
    const delivery = await emailService.createDelivery({
      context,
      templateKey: "interview_invitation",
      templateVariables: {
        companyName: "Aptly",
        recipientName: displayCandidateName(invitation.candidate),
        supportEmail: "support@aptly.local",
        actionUrl: actionUrl.toString(),
        expirationDate: expiresAt.toISOString(),
        jobTitle: invitation.job.title,
        estimatedDuration: "30 minutes",
        interviewWindow: "Complete before the expiration date shown above.",
      },
      recipientEmail: invitation.email,
      recipientName: displayCandidateName(invitation.candidate),
      provider: env.EMAIL_DELIVERY_MODE,
      idempotencyKey:
        input.idempotencyKey ??
        `candidate-invitation:${invitation.companyId}:${invitation.id}:${tokenHash.slice(0, 16)}`,
    });
    await emailService.enqueueDelivery({ context, deliveryId: delivery.id });
    await prisma.candidateInvitation.update({
      where: { companyId_id: { companyId: input.tenant.companyId, id: input.invitationId } },
      data: { status: "SENT", sentAt: new Date() },
    });
    await this.audit(
      "candidate.invitation_activated",
      input.tenant.companyId,
      input.actor,
      input.request,
      {
        resourceType: "candidate_invitation",
        resourceId: invitation.id,
        after: { id: invitation.id, expiresAt, status: "SENT", tokenHash: "[redacted]" },
      },
    );
    return { invitationId: invitation.id, expiresAt };
  }

  public async exchangeToken(input: {
    readonly token: string;
    readonly request: CandidateRequestContext;
  }): Promise<CandidateLinkExchangeResult> {
    if (!isWellFormedToken(input.token)) {
      await this.recordTokenAttempt(null, null, input.token, "MALFORMED", input.request);
      return { ok: false, reason: "invalid" };
    }

    const hash = hashCandidateToken(input.token);
    const now = new Date();
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { tokenHash: hash },
      include: { candidate: true },
    });
    if (invitation === null || !timingSafeHashEqual(invitation.tokenHash, hash)) {
      await this.recordTokenAttempt(null, null, input.token, "NOT_FOUND", input.request);
      return { ok: false, reason: "invalid" };
    }

    const terminalReason = classifyInvitationForExchange(invitation, now);
    if (terminalReason !== null) {
      await this.recordTokenAttempt(
        invitation.companyId,
        invitation.id,
        input.token,
        tokenOutcomeFromReason(terminalReason),
        input.request,
      );
      return { ok: false, reason: terminalReason };
    }

    const activeSession = await prisma.candidateSession.findFirst({
      where: {
        companyId: invitation.companyId,
        invitationId: invitation.id,
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
    });
    if (activeSession !== null) {
      await this.recordTokenAttempt(
        invitation.companyId,
        invitation.id,
        input.token,
        "CONSUMED",
        input.request,
      );
      return { ok: false, reason: "in_progress" };
    }

    const sessionToken = createCandidateSessionToken();
    const csrfToken = createCandidateCsrfToken();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    const session = await prisma.$transaction(async (tx) => {
      const consumed = await tx.candidateInvitation.updateMany({
        where: {
          companyId: invitation.companyId,
          id: invitation.id,
          tokenHash: hash,
          tokenConsumedAt: null,
          tokenRevokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          tokenConsumedAt: now,
          status: "OPENED",
          openedAt: invitation.openedAt ?? now,
        },
      });
      if (consumed.count !== 1) {
        throw new CandidatePortalError("Interview link cannot be used.", "invalid_link");
      }
      return tx.candidateSession.create({
        data: {
          companyId: invitation.companyId,
          candidateId: invitation.candidateId,
          invitationId: invitation.id,
          interviewSessionId: null,
          sessionTokenHash: hashCandidateToken(sessionToken),
          csrfTokenHash: hashCandidateToken(csrfToken),
          activeLockKey: invitation.id,
          status: "ACTIVE",
          createdFromIpHash: hashIpAddress(input.request.ipAddress),
          createdFromUserAgent: truncate(input.request.userAgent, 500),
          lastSeenAt: now,
          expiresAt,
          metadataJson: {},
        },
      });
    });
    await this.recordTokenAttempt(
      invitation.companyId,
      invitation.id,
      input.token,
      "SUCCESS",
      input.request,
    );
    await this.audit(
      "candidate.session_created",
      invitation.companyId,
      { type: "candidate_session", id: session.id },
      input.request,
      {
        resourceType: "candidate_session",
        resourceId: session.id,
        after: safeSessionAudit(session),
      },
    );
    return {
      ok: true,
      sessionId: session.id as CandidateSessionId,
      sessionToken,
      csrfToken,
      expiresAt,
      nextPath: "/candidate/welcome",
    };
  }

  public async requireSession(
    sessionToken: string | undefined,
    request: CandidateRequestContext,
  ): Promise<CandidateSessionContext> {
    void request;
    if (sessionToken === undefined || !isWellFormedToken(sessionToken)) {
      throw new CandidatePortalError("Candidate session is required.", "session_required");
    }
    const session = await prisma.candidateSession.findUnique({
      where: { sessionTokenHash: hashCandidateToken(sessionToken) },
    });
    if (session?.status !== "ACTIVE" || session.expiresAt <= new Date()) {
      throw new CandidatePortalError("Candidate session is required.", "session_required");
    }
    await prisma.candidateSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
    return {
      companyId: session.companyId as TenantId,
      sessionId: session.id as CandidateSessionId,
      candidateId: session.candidateId,
      invitationId: session.invitationId,
      interviewSessionId: session.interviewSessionId,
      expiresAt: session.expiresAt,
      csrfTokenHash: session.csrfTokenHash,
    };
  }

  public assertCandidateCsrf(session: CandidateSessionContext, csrfToken: string | null): void {
    if (
      csrfToken === null ||
      !timingSafeHashEqual(session.csrfTokenHash, hashCandidateToken(csrfToken))
    ) {
      throw new CandidatePortalError("Candidate request verification failed.", "csrf_failed");
    }
  }

  public async getStatus(session: CandidateSessionContext): Promise<CandidatePortalStatus> {
    const record = await prisma.candidateSession.findUniqueOrThrow({
      where: { companyId_id: { companyId: session.companyId, id: session.sessionId } },
      include: {
        candidate: true,
        invitation: { include: { job: true } },
        consentRecords: { orderBy: { createdAt: "desc" } },
        readinessChecks: { orderBy: { checkedAt: "desc" } },
        identityVerifications: { orderBy: { createdAt: "desc" } },
        withdrawals: true,
      },
    });
    return {
      sessionId: record.id as CandidateSessionId,
      expiresAt: record.expiresAt,
      invitation: {
        id: record.invitation.id,
        status: record.invitation.status,
        expiresAt: record.invitation.expiresAt,
      },
      candidate: {
        id: record.candidate.id,
        name: displayCandidateName(record.candidate),
        email: record.candidate.primaryEmail ?? record.invitation.email,
      },
      job: {
        id: record.invitation.job.id,
        title: record.invitation.job.title,
      },
      consents: record.consentRecords.map((consent) => ({
        type: consent.type,
        accepted: consent.accepted,
        consentVersion: consent.consentVersion,
        policyVersion: consent.policyVersion,
      })),
      readiness: record.readinessChecks.map((check) => ({
        type: check.type,
        status: check.status,
        checkedAt: check.checkedAt,
      })),
      identityVerificationStatus: record.identityVerifications[0]?.status ?? null,
      withdrawn: record.withdrawals.length > 0,
    };
  }

  public async createResumeToken(
    session: CandidateSessionContext,
  ): Promise<{ readonly token: string; readonly expiresAt: Date }> {
    const token = createInvitationToken();
    const expiresAt = new Date(Date.now() + RESUME_DURATION_MS);
    await prisma.candidateSessionContinuation.create({
      data: {
        companyId: session.companyId,
        candidateSessionId: session.sessionId,
        resumeTokenHash: hashCandidateToken(token),
        expiresAt,
      },
    });
    return { token, expiresAt };
  }

  public async submitConsents(input: {
    readonly session: CandidateSessionContext;
    readonly request: CandidateRequestContext;
    readonly consents: readonly {
      readonly type: CandidateConsentType;
      readonly accepted: boolean;
    }[];
  }): Promise<void> {
    if (input.consents.length === 0) {
      throw new CandidatePortalError(
        "At least one consent decision is required.",
        "validation_failed",
      );
    }
    await prisma.$transaction(
      input.consents.map((consent) =>
        prisma.candidateConsentRecord.create({
          data: {
            companyId: input.session.companyId,
            candidateId: input.session.candidateId,
            invitationId: input.session.invitationId,
            candidateSessionId: input.session.sessionId,
            interviewSessionId: input.session.interviewSessionId,
            type: consent.type,
            consentVersion: CONSENT_VERSION,
            policyVersion: PRIVACY_POLICY_VERSION,
            accepted: consent.accepted,
            acceptedAt: consent.accepted ? new Date() : null,
            deniedAt: consent.accepted ? null : new Date(),
            ipAddressHash: hashIpAddress(input.request.ipAddress),
            userAgent: truncate(input.request.userAgent, 500),
            metadataJson: {},
          },
        }),
      ),
    );
    await this.audit(
      "candidate.consent_submitted",
      input.session.companyId,
      { type: "candidate_session", id: input.session.sessionId },
      input.request,
      {
        resourceType: "candidate_session",
        resourceId: input.session.sessionId,
        after: { consentTypes: input.consents.map((consent) => consent.type) },
      },
    );
  }

  public async submitReadiness(input: {
    readonly session: CandidateSessionContext;
    readonly request: CandidateRequestContext;
    readonly checks: readonly ReadinessSubmission[];
  }): Promise<void> {
    if (input.checks.length === 0) {
      throw new CandidatePortalError(
        "At least one readiness check is required.",
        "validation_failed",
      );
    }
    await prisma.readinessCheck.createMany({
      data: input.checks.map((check) => ({
        companyId: input.session.companyId,
        candidateId: input.session.candidateId,
        invitationId: input.session.invitationId,
        candidateSessionId: input.session.sessionId,
        interviewSessionId: input.session.interviewSessionId,
        type: check.type,
        status: check.status,
        detailsJson: sanitizeJson(check.details) as Prisma.InputJsonObject,
        checkedAt: new Date(),
      })),
    });
    await this.audit(
      "candidate.readiness_submitted",
      input.session.companyId,
      { type: "candidate_session", id: input.session.sessionId },
      input.request,
      {
        resourceType: "candidate_session",
        resourceId: input.session.sessionId,
        after: { checkCount: input.checks.length },
      },
    );
  }

  public async submitIdentity(input: {
    readonly session: CandidateSessionContext;
    readonly request: CandidateRequestContext;
    readonly selfAttestedName: string;
    readonly confirmedName: string;
    readonly snapshot?: {
      readonly storageRef: string;
      readonly contentType: string;
      readonly sizeBytes: number;
      readonly checksumSha256: string;
    } | null;
  }): Promise<void> {
    const selfAttestedName = normalizeText(input.selfAttestedName, 160, "Self-attested name");
    const confirmedName = normalizeText(input.confirmedName, 160, "Confirmed name");
    await prisma.$transaction(async (tx) => {
      const verification = await tx.identityVerification.create({
        data: {
          companyId: input.session.companyId,
          candidateId: input.session.candidateId,
          invitationId: input.session.invitationId,
          candidateSessionId: input.session.sessionId,
          interviewSessionId: input.session.interviewSessionId,
          provider: "INTERNAL_SELF_ATTESTATION",
          status:
            input.snapshot === null || input.snapshot === undefined
              ? "SELF_ATTESTED"
              : "SNAPSHOT_SUBMITTED",
          selfAttestedName,
          confirmedName,
          consentedAt: new Date(),
          metadataJson: { dataClassification: "restricted" },
        },
      });
      if (input.snapshot !== null && input.snapshot !== undefined) {
        await tx.webcamSnapshot.create({
          data: {
            companyId: input.session.companyId,
            candidateId: input.session.candidateId,
            invitationId: input.session.invitationId,
            candidateSessionId: input.session.sessionId,
            interviewSessionId: input.session.interviewSessionId,
            identityVerificationId: verification.id,
            storageRef: normalizeStorageRef(input.snapshot.storageRef),
            contentType: normalizeSnapshotContentType(input.snapshot.contentType),
            sizeBytes: validateSnapshotSize(input.snapshot.sizeBytes),
            checksumSha256: normalizeChecksum(input.snapshot.checksumSha256),
            capturedAt: new Date(),
            metadataJson: { dataClassification: "restricted", storagePendingMediaPhase: true },
          },
        });
      }
    });
    await this.audit(
      "candidate.identity_submitted",
      input.session.companyId,
      { type: "candidate_session", id: input.session.sessionId },
      input.request,
      {
        resourceType: "candidate_session",
        resourceId: input.session.sessionId,
        after: {
          selfAttestedName,
          confirmedName,
          snapshotMetadataProvided: input.snapshot !== null && input.snapshot !== undefined,
        },
      },
    );
  }

  public async createAccommodationRequest(input: {
    readonly session: CandidateSessionContext;
    readonly request: CandidateRequestContext;
    readonly type: "WEBCAM_ALTERNATIVE" | "TIME_EXTENSION" | "ACCESSIBILITY_SUPPORT" | "OTHER";
    readonly contactEmail: string;
    readonly message: string;
  }): Promise<void> {
    const record = await prisma.accommodationRequest.create({
      data: {
        companyId: input.session.companyId,
        candidateId: input.session.candidateId,
        invitationId: input.session.invitationId,
        candidateSessionId: input.session.sessionId,
        type: input.type,
        contactEmail: normalizeEmail(input.contactEmail),
        message: normalizeText(input.message, 2_000, "Accommodation message"),
        metadataJson: {},
      },
    });
    await this.createHrNotificationIntent(
      input.session,
      "CANDIDATE_ACCOMMODATION_REQUESTED",
      record.id,
      {
        type: record.type,
      },
    );
    await this.audit(
      "candidate.accommodation_requested",
      input.session.companyId,
      { type: "candidate_session", id: input.session.sessionId },
      input.request,
      {
        resourceType: "accommodation_request",
        resourceId: record.id,
        after: { id: record.id, type: record.type, status: record.status },
      },
    );
  }

  public async createSupportRequest(input: {
    readonly session: CandidateSessionContext;
    readonly request: CandidateRequestContext;
    readonly category: "TECHNICAL" | "ACCESSIBILITY" | "SCHEDULING" | "PRIVACY" | "OTHER";
    readonly contactEmail: string;
    readonly message: string;
  }): Promise<void> {
    const record = await prisma.candidateSupportRequest.create({
      data: {
        companyId: input.session.companyId,
        candidateId: input.session.candidateId,
        invitationId: input.session.invitationId,
        candidateSessionId: input.session.sessionId,
        category: input.category,
        contactEmail: normalizeEmail(input.contactEmail),
        message: normalizeText(input.message, 2_000, "Support message"),
        metadataJson: {},
      },
    });
    await this.createHrNotificationIntent(input.session, "CANDIDATE_SUPPORT_REQUESTED", record.id, {
      category: record.category,
    });
    await this.audit(
      "candidate.support_requested",
      input.session.companyId,
      { type: "candidate_session", id: input.session.sessionId },
      input.request,
      {
        resourceType: "candidate_support_request",
        resourceId: record.id,
        after: { id: record.id, category: record.category, status: record.status },
      },
    );
  }

  public async withdraw(input: {
    readonly session: CandidateSessionContext;
    readonly request: CandidateRequestContext;
    readonly reason?: string | null;
  }): Promise<void> {
    const now = new Date();
    const record = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.candidateWithdrawal.upsert({
        where: {
          companyId_invitationId: {
            companyId: input.session.companyId,
            invitationId: input.session.invitationId,
          },
        },
        update: {
          reason: normalizeOptionalText(input.reason ?? null, 1_000, "Withdrawal reason"),
          confirmedAt: now,
        },
        create: {
          companyId: input.session.companyId,
          candidateId: input.session.candidateId,
          invitationId: input.session.invitationId,
          candidateSessionId: input.session.sessionId,
          reason: normalizeOptionalText(input.reason ?? null, 1_000, "Withdrawal reason"),
          confirmedAt: now,
          metadataJson: {},
        },
      });
      await tx.candidateInvitation.update({
        where: {
          companyId_id: { companyId: input.session.companyId, id: input.session.invitationId },
        },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      await tx.candidateSession.update({
        where: {
          companyId_id: { companyId: input.session.companyId, id: input.session.sessionId },
        },
        data: { status: "REVOKED", revokedAt: now, activeLockKey: null },
      });
      return withdrawal;
    });
    await this.createHrNotificationIntent(input.session, "CANDIDATE_WITHDRAWN", record.id, {});
    await this.audit(
      "candidate.withdrawn",
      input.session.companyId,
      { type: "candidate_session", id: input.session.sessionId },
      input.request,
      {
        resourceType: "candidate_withdrawal",
        resourceId: record.id,
        after: { id: record.id, invitationId: record.invitationId },
      },
    );
  }

  public async markReadyToStart(input: {
    readonly session: CandidateSessionContext;
    readonly request: CandidateRequestContext;
  }): Promise<void> {
    await prisma.candidateSession.update({
      where: { companyId_id: { companyId: input.session.companyId, id: input.session.sessionId } },
      data: { metadataJson: { readyToStartAt: new Date().toISOString() } },
    });
    await this.audit(
      "candidate.ready_to_start_confirmed",
      input.session.companyId,
      { type: "candidate_session", id: input.session.sessionId },
      input.request,
      {
        resourceType: "candidate_session",
        resourceId: input.session.sessionId,
        after: { readyToStart: true },
      },
    );
  }

  public async revokeSession(
    session: CandidateSessionContext,
    request: CandidateRequestContext,
  ): Promise<void> {
    await prisma.candidateSession.update({
      where: { companyId_id: { companyId: session.companyId, id: session.sessionId } },
      data: { status: "REVOKED", revokedAt: new Date(), activeLockKey: null },
    });
    await this.audit(
      "candidate.session_revoked",
      session.companyId,
      { type: "candidate_session", id: session.sessionId },
      request,
      {
        resourceType: "candidate_session",
        resourceId: session.sessionId,
        after: { status: "REVOKED" },
      },
    );
  }

  private async recordTokenAttempt(
    companyId: string | null,
    invitationId: string | null,
    token: string,
    outcome: CandidateTokenAttemptOutcome,
    request: CandidateRequestContext,
  ): Promise<void> {
    await prisma.candidateTokenAttempt.create({
      data: {
        companyId,
        invitationId,
        tokenHashPrefix: isWellFormedToken(token) ? tokenHashPrefix(token) : null,
        ipAddressHash: hashIpAddress(request.ipAddress),
        outcome,
        metadataJson: {
          requestId: request.requestId,
          correlationId: request.correlationId,
          userAgent: truncate(request.userAgent, 200),
        },
      },
    });
  }

  private async createHrNotificationIntent(
    session: CandidateSessionContext,
    type: string,
    targetResourceId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await prisma.notificationIntent.create({
      data: {
        companyId: session.companyId,
        type: type as NotificationIntentType,
        channel: "EMAIL",
        status: "PENDING",
        recipientEmail: "hr-notifications@aptly.local",
        recipientName: "Hiring team",
        targetResourceType: "candidate_session",
        targetResourceId,
        payloadJson: {
          schemaVersion: 1,
          candidateId: session.candidateId,
          invitationId: session.invitationId,
          ...payload,
        },
      },
    });
  }

  private async audit(
    action: string,
    companyId: string,
    actor: AuditActor,
    request: CandidateRequestContext,
    details: {
      readonly resourceType: string;
      readonly resourceId: string;
      readonly before?: unknown;
      readonly after?: unknown;
    },
  ): Promise<void> {
    await this.auditWriter.record({
      companyId: companyId as TenantId,
      actor,
      request: toAuditRequest(request, actor.type === "candidate_session" ? actor.id : null),
      action,
      resourceType: details.resourceType,
      resourceId: details.resourceId,
      riskLevel: "medium",
      before: details.before,
      after: details.after,
    });
  }
}

function computeExpiry(hours: number | null): Date {
  if (hours === null) {
    return new Date(Date.now() + DEFAULT_INVITATION_EXPIRY_MS);
  }
  const ms = hours * 60 * 60 * 1000;
  if (!Number.isFinite(ms) || ms < MIN_INVITATION_EXPIRY_MS || ms > MAX_INVITATION_EXPIRY_MS) {
    throw new CandidatePortalError(
      "Invitation expiry is outside platform limits.",
      "validation_failed",
    );
  }
  return new Date(Date.now() + ms);
}

function classifyInvitationForExchange(
  invitation: {
    readonly status: string;
    readonly expiresAt: Date;
    readonly tokenRevokedAt: Date | null;
    readonly tokenConsumedAt: Date | null;
  },
  now: Date,
): "expired" | "revoked" | "completed" | "in_progress" | null {
  if (invitation.expiresAt <= now || invitation.status === "EXPIRED") return "expired";
  if (invitation.tokenRevokedAt !== null || invitation.status === "CANCELLED") return "revoked";
  if (invitation.status === "ACCEPTED") return "completed";
  if (invitation.tokenConsumedAt !== null) return "in_progress";
  return null;
}

function tokenOutcomeFromReason(
  reason: "expired" | "revoked" | "completed" | "in_progress",
): CandidateTokenAttemptOutcome {
  switch (reason) {
    case "expired":
      return "EXPIRED";
    case "revoked":
      return "REVOKED";
    case "completed":
      return "COMPLETED";
    case "in_progress":
      return "CONSUMED";
  }
}

function displayCandidateName(candidate: {
  readonly fullName: string;
  readonly primaryEmail: string | null;
}): string {
  const name = candidate.fullName.trim();
  return name.length > 0 ? name : (candidate.primaryEmail ?? "Candidate");
}

function truncate(value: string | null, maxLength: number): string | null {
  if (value === null) return null;
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function normalizeText(value: string, maxLength: number, label: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new CandidatePortalError(
      `${label} must be between 1 and ${String(maxLength)} characters.`,
      "validation_failed",
    );
  }
  return normalized;
}

function normalizeOptionalText(
  value: string | null,
  maxLength: number,
  label: string,
): string | null {
  if (value === null || value.trim().length === 0) return null;
  return normalizeText(value, maxLength, label);
}

function normalizeStorageRef(value: string): string {
  const normalized = normalizeText(value, 300, "Snapshot storage reference");
  if (!/^candidate-snapshots\/[a-zA-Z0-9/_:.-]+$/u.test(normalized)) {
    throw new CandidatePortalError("Snapshot storage reference is invalid.", "validation_failed");
  }
  return normalized;
}

function normalizeSnapshotContentType(value: string): string {
  if (value !== "image/jpeg" && value !== "image/png" && value !== "image/webp") {
    throw new CandidatePortalError("Snapshot content type is not supported.", "validation_failed");
  }
  return value;
}

function validateSnapshotSize(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5_000_000) {
    throw new CandidatePortalError("Snapshot size is invalid.", "validation_failed");
  }
  return value;
}

function normalizeChecksum(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(normalized)) {
    throw new CandidatePortalError("Snapshot checksum is invalid.", "validation_failed");
  }
  return normalized;
}

function sanitizeJson(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function safeSessionAudit(session: {
  readonly id: string;
  readonly companyId: string;
  readonly invitationId: string;
  readonly expiresAt: Date;
  readonly status: string;
}): Record<string, unknown> {
  return {
    id: session.id,
    companyId: session.companyId,
    invitationId: session.invitationId,
    expiresAt: session.expiresAt,
    status: session.status,
    sessionTokenHash: "[redacted]",
    csrfTokenHash: "[redacted]",
  };
}

function toAuditRequest(
  request: CandidateRequestContext,
  sessionId: string | null = null,
): AuditRequestContext {
  return {
    requestId: request.requestId,
    correlationId: request.correlationId,
    sessionId,
    ipAddress: request.ipAddress,
    userAgent: request.userAgent,
  };
}
