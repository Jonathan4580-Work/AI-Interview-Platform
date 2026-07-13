import { prisma } from "@/infra/database";

import { InterviewDomainError } from "./service";

import type {
  CandidateSafePlan,
  CandidateSafeQuestion,
  InterviewActivityType,
  InterviewQuestionKind,
  InterviewQuestionStateId,
  InterviewQuestionStateRecord,
  InterviewQuestionStatus,
  InterviewRecoveryCheckpointId,
  InterviewRecoveryType,
  InterviewRepository,
  InterviewSessionRecord,
  InterviewSessionStatus,
  InterviewTurnId,
  InterviewTurnMediaRecord,
  InterviewTurnMediaStatus,
  InterviewTurnRecord,
  InterviewTurnSpeaker,
  InterviewTurnStatus,
} from "./types";
import type { CandidateSessionContext, CandidateSessionId } from "@/modules/candidate-portal";
import type { InterviewSessionId } from "@/modules/invitations";
import type { MediaObjectId } from "@/modules/media";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type {
  InterviewActivityEvent,
  InterviewQuestionState,
  InterviewSession,
  InterviewTurn,
  InterviewTurnMedia,
  Prisma,
} from "@prisma/client";

export class PrismaInterviewRepository implements InterviewRepository {
  public async findSession(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<InterviewSessionRecord | null> {
    const record = await prisma.interviewSession.findUnique({
      where: { companyId_id: { companyId: tenant.companyId, id: interviewSessionId } },
    });
    return record === null ? null : mapSession(record);
  }

  public async findSessionForCandidate(input: {
    readonly session: CandidateSessionContext;
  }): Promise<InterviewSessionRecord | null> {
    const where =
      input.session.interviewSessionId === null
        ? {
            companyId_invitationId: {
              companyId: input.session.companyId,
              invitationId: input.session.invitationId,
            },
          }
        : {
            companyId_id: {
              companyId: input.session.companyId,
              id: input.session.interviewSessionId,
            },
          };
    const record = await prisma.interviewSession.findUnique({ where });
    return record === null ? null : mapSession(record);
  }

  public async assertCandidatePrepared(session: CandidateSessionContext): Promise<void> {
    const candidateSession = await prisma.candidateSession.findUnique({
      where: { companyId_id: { companyId: session.companyId, id: session.sessionId } },
      select: { metadataJson: true },
    });
    const metadata = asRecord(candidateSession?.metadataJson);
    if (typeof metadata.readyToStartAt !== "string") {
      throw new InterviewDomainError(
        "Candidate readiness must be completed before starting.",
        "invalid_state",
      );
    }

    const requiredConsentTypes = [
      "INTERVIEW_PARTICIPATION",
      "CAMERA_USE",
      "MICROPHONE_USE",
      "FUTURE_AUDIO_VIDEO_RECORDING",
      "PRIVACY_NOTICE",
      "DATA_PROCESSING_RETENTION",
    ] as const;
    const accepted = await prisma.candidateConsentRecord.findMany({
      where: {
        companyId: session.companyId,
        candidateSessionId: session.sessionId,
        invitationId: session.invitationId,
        accepted: true,
        type: { in: [...requiredConsentTypes] },
      },
      select: { type: true },
    });
    const acceptedTypes = new Set(accepted.map((record) => record.type));
    if (requiredConsentTypes.some((type) => !acceptedTypes.has(type))) {
      throw new InterviewDomainError(
        "Required candidate consent must be accepted before starting.",
        "invalid_state",
      );
    }
  }

  public async startSession(input: {
    readonly session: CandidateSessionContext;
    readonly plan: CandidateSafePlan;
    readonly now: Date;
    readonly resumeAllowedUntil: Date;
  }): Promise<{ readonly session: InterviewSessionRecord; readonly created: boolean }> {
    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.candidateInvitation.findUnique({
        where: {
          companyId_id: {
            companyId: input.session.companyId,
            id: input.session.invitationId,
          },
        },
      });
      if (invitation === null) {
        throw new InterviewDomainError("Invitation was not found.", "not_found");
      }
      if (
        invitation.status === "CANCELLED" ||
        invitation.status === "EXPIRED" ||
        invitation.expiresAt <= input.now
      ) {
        throw new InterviewDomainError("Invitation cannot start an interview.", "invalid_state");
      }

      const existing = await tx.interviewSession.findUnique({
        where: {
          companyId_invitationId: {
            companyId: input.session.companyId,
            invitationId: input.session.invitationId,
          },
        },
      });
      if (existing !== null) {
        const updated =
          existing.status === "IN_PROGRESS"
            ? existing
            : await tx.interviewSession.update({
                where: {
                  companyId_id: { companyId: input.session.companyId, id: existing.id },
                },
                data: {
                  status: "IN_PROGRESS",
                  startedAt: existing.startedAt ?? input.now,
                  lastActivityAt: input.now,
                  resumeAllowedUntil: input.resumeAllowedUntil,
                  currentQuestionSequence: existing.currentQuestionSequence ?? 1,
                  planSnapshotJson: existing.planSnapshotJson ?? toInputJson(input.plan),
                },
              });
        await tx.candidateSession.update({
          where: {
            companyId_id: {
              companyId: input.session.companyId,
              id: input.session.sessionId,
            },
          },
          data: { interviewSessionId: updated.id, lastSeenAt: input.now },
        });
        return { session: updated, created: false };
      }

      const created = await tx.interviewSession.create({
        data: {
          companyId: input.session.companyId,
          candidateId: input.session.candidateId,
          invitationId: input.session.invitationId,
          applicationId: invitation.applicationId,
          interviewPlanVersionId: input.plan.versionId,
          status: "IN_PROGRESS",
          startedAt: input.now,
          lastActivityAt: input.now,
          currentQuestionSequence: 1,
          resumeAllowedUntil: input.resumeAllowedUntil,
          expiresAt: input.session.expiresAt,
          planSnapshotJson: toInputJson(input.plan),
          metadataJson: {},
        },
      });
      await tx.candidateSession.update({
        where: {
          companyId_id: {
            companyId: input.session.companyId,
            id: input.session.sessionId,
          },
        },
        data: { interviewSessionId: created.id, lastSeenAt: input.now },
      });
      await tx.candidateInvitation.update({
        where: {
          companyId_id: {
            companyId: input.session.companyId,
            id: input.session.invitationId,
          },
        },
        data: { status: "ACCEPTED", acceptedAt: invitation.acceptedAt ?? input.now },
      });
      return { session: created, created: true };
    });
    return { session: mapSession(result.session), created: result.created };
  }

  public async updateSessionStatus(input: {
    readonly tenant: TenantContext;
    readonly sessionId: InterviewSessionId;
    readonly fromStatuses: readonly InterviewSessionStatus[];
    readonly toStatus: InterviewSessionStatus;
    readonly at: Date;
    readonly currentQuestionSequence?: number | null;
    readonly resumeAllowedUntil?: Date | null;
    readonly processingWorkflowId?: string | null;
  }): Promise<InterviewSessionRecord | null> {
    const existing = await prisma.interviewSession.findFirst({
      where: {
        companyId: input.tenant.companyId,
        id: input.sessionId,
        status: { in: input.fromStatuses.map(toPrismaSessionStatus) },
      },
    });
    if (existing === null) return null;
    const updated = await prisma.interviewSession.update({
      where: { companyId_id: { companyId: input.tenant.companyId, id: input.sessionId } },
      data: {
        status: toPrismaSessionStatus(input.toStatus),
        lastActivityAt: input.at,
        ...(input.toStatus === "in_progress" ? { startedAt: existing.startedAt ?? input.at } : {}),
        ...(input.toStatus === "interrupted" ? { interruptedAt: input.at } : {}),
        ...(input.toStatus === "completed"
          ? {
              completedAt: input.at,
              durationSeconds:
                existing.startedAt === null
                  ? null
                  : Math.max(
                      0,
                      Math.floor((input.at.getTime() - existing.startedAt.getTime()) / 1000),
                    ),
            }
          : {}),
        ...(input.currentQuestionSequence === undefined
          ? {}
          : { currentQuestionSequence: input.currentQuestionSequence }),
        ...(input.resumeAllowedUntil === undefined
          ? {}
          : { resumeAllowedUntil: input.resumeAllowedUntil }),
        ...(input.processingWorkflowId === undefined
          ? {}
          : { processingWorkflowId: input.processingWorkflowId }),
      },
    });
    return mapSession(updated);
  }

  public async loadCandidateSafePlan(input: {
    readonly session: CandidateSessionContext;
  }): Promise<CandidateSafePlan> {
    const invitation = await prisma.candidateInvitation.findUnique({
      where: {
        companyId_id: { companyId: input.session.companyId, id: input.session.invitationId },
      },
    });
    if (invitation === null) {
      throw new InterviewDomainError("Invitation was not found.", "not_found");
    }
    const planVersionId =
      invitation.interviewPlanVersionId ??
      (await findActiveJobPlanVersionId(input.session.companyId, invitation.jobId));
    if (planVersionId === null) {
      throw new InterviewDomainError("Published interview plan is missing.", "invalid_state");
    }
    const version = await prisma.interviewPlanVersion.findUnique({
      where: {
        companyId_id: { companyId: input.session.companyId, id: planVersionId },
      },
    });
    if (version?.status !== "PUBLISHED" || version.publishedAt === null) {
      throw new InterviewDomainError(
        "Published interview plan version is unavailable.",
        "invalid_state",
      );
    }
    const questions = projectQuestions(version.questionBlueprintJson);
    return {
      versionId: version.id,
      versionNumber: version.versionNumber,
      durationMinutes: version.durationMinutes,
      questions,
    };
  }

  public async ensureQuestionStates(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly questions: readonly CandidateSafeQuestion[];
  }): Promise<readonly InterviewQuestionStateRecord[]> {
    await prisma.$transaction(
      input.questions.map((question) =>
        prisma.interviewQuestionState.upsert({
          where: {
            companyId_interviewSessionId_sequence: {
              companyId: input.tenant.companyId,
              interviewSessionId: input.interviewSessionId,
              sequence: question.sequence,
            },
          },
          update: {},
          create: {
            companyId: input.tenant.companyId,
            interviewSessionId: input.interviewSessionId,
            sequence: question.sequence,
            questionKey: question.key,
            kind: toPrismaQuestionKind(question.kind),
            prompt: question.prompt,
            required: question.required,
            metadataJson: {},
          },
        }),
      ),
    );
    return this.listQuestionStates(input.tenant, input.interviewSessionId);
  }

  public async listQuestionStates(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<readonly InterviewQuestionStateRecord[]> {
    const records = await prisma.interviewQuestionState.findMany({
      where: { companyId: tenant.companyId, interviewSessionId },
      orderBy: { sequence: "asc" },
    });
    return records.map(mapQuestionState);
  }

  public async updateQuestionStatus(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly sequence: number;
    readonly fromStatuses: readonly InterviewQuestionStatus[];
    readonly toStatus: InterviewQuestionStatus;
    readonly at: Date;
  }): Promise<InterviewQuestionStateRecord | null> {
    const existing = await prisma.interviewQuestionState.findFirst({
      where: {
        companyId: input.tenant.companyId,
        interviewSessionId: input.interviewSessionId,
        sequence: input.sequence,
        status: { in: input.fromStatuses.map(toPrismaQuestionStatus) },
      },
    });
    if (existing === null) return null;
    const updated = await prisma.interviewQuestionState.update({
      where: { companyId_id: { companyId: input.tenant.companyId, id: existing.id } },
      data: {
        status: toPrismaQuestionStatus(input.toStatus),
        ...(input.toStatus === "active" ? { startedAt: existing.startedAt ?? input.at } : {}),
        ...(input.toStatus === "answered" || input.toStatus === "skipped"
          ? { completedAt: input.at }
          : {}),
      },
    });
    return mapQuestionState(updated);
  }

  public async findTurnByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<InterviewTurnRecord | null> {
    const record = await prisma.interviewTurn.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: input.companyId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    return record === null ? null : mapTurn(record);
  }

  public async createTurn(
    input: Parameters<InterviewRepository["createTurn"]>[0],
  ): Promise<InterviewTurnRecord> {
    const created = await prisma.interviewTurn.create({
      data: {
        companyId: input.companyId,
        interviewSessionId: input.interviewSessionId,
        questionStateId: input.questionStateId,
        sequence: input.sequence,
        attemptNumber: input.attemptNumber,
        speaker: toPrismaTurnSpeaker(input.speaker),
        idempotencyKey: input.idempotencyKey,
        startedAt: input.startedAt,
        metadataJson: toInputJson(input.metadata),
      },
    });
    return mapTurn(created);
  }

  public async completeTurn(
    input: Parameters<InterviewRepository["completeTurn"]>[0],
  ): Promise<InterviewTurnRecord | null> {
    const existing = await prisma.interviewTurn.findFirst({
      where: { companyId: input.tenant.companyId, id: input.turnId, status: "STARTED" },
    });
    if (existing === null) return null;
    const updated = await prisma.interviewTurn.update({
      where: { companyId_id: { companyId: input.tenant.companyId, id: input.turnId } },
      data: {
        status: "COMPLETED",
        content: input.content,
        endedAt: input.endedAt,
        confirmedAt: input.endedAt,
        metadataJson: toInputJson(input.metadata),
      },
    });
    return mapTurn(updated);
  }

  public async listTurns(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<readonly InterviewTurnRecord[]> {
    const records = await prisma.interviewTurn.findMany({
      where: { companyId: tenant.companyId, interviewSessionId },
      orderBy: [{ sequence: "asc" }, { attemptNumber: "asc" }],
    });
    return records.map(mapTurn);
  }

  public async attachTurnMedia(
    input: Parameters<InterviewRepository["attachTurnMedia"]>[0],
  ): Promise<InterviewTurnMediaRecord> {
    const media = await prisma.mediaObject.findFirst({
      where: {
        companyId: input.companyId,
        id: input.mediaObjectId,
        subjectType: "INTERVIEW_SESSION",
        subjectId: input.interviewSessionId,
        purpose: "INTERVIEW_RECORDING",
        uploadStatus: "COMPLETED",
        processingStatus: "READY",
      },
    });
    if (media === null) {
      throw new InterviewDomainError(
        "Recording media is not verified for this interview.",
        "forbidden",
      );
    }
    const record = await prisma.interviewTurnMedia.upsert({
      where: {
        companyId_interviewTurnId_mediaObjectId: {
          companyId: input.companyId,
          interviewTurnId: input.turnId,
          mediaObjectId: input.mediaObjectId,
        },
      },
      update: {
        status: toPrismaTurnMediaStatus(input.status),
        durationMs: input.durationMs,
        metadataJson: toInputJson(input.metadata),
      },
      create: {
        companyId: input.companyId,
        interviewSessionId: input.interviewSessionId,
        interviewTurnId: input.turnId,
        mediaObjectId: input.mediaObjectId,
        chunkSequence: input.chunkSequence,
        durationMs: input.durationMs,
        status: toPrismaTurnMediaStatus(input.status),
        metadataJson: toInputJson(input.metadata),
      },
    });
    return mapTurnMedia(record);
  }

  public async listTurnMedia(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<readonly InterviewTurnMediaRecord[]> {
    const records = await prisma.interviewTurnMedia.findMany({
      where: { companyId: tenant.companyId, interviewSessionId },
      orderBy: [{ interviewTurnId: "asc" }, { chunkSequence: "asc" }],
    });
    return records.map(mapTurnMedia);
  }

  public async hasUnverifiedRequiredMedia(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<boolean> {
    const candidateTurns = await prisma.interviewTurn.findMany({
      where: {
        companyId: tenant.companyId,
        interviewSessionId,
        speaker: "CANDIDATE",
        status: "COMPLETED",
      },
      select: { id: true },
    });
    for (const turn of candidateTurns) {
      const verifiedMediaCount = await prisma.interviewTurnMedia.count({
        where: {
          companyId: tenant.companyId,
          interviewSessionId,
          interviewTurnId: turn.id,
          status: "VERIFIED",
          mediaObject: {
            uploadStatus: "COMPLETED",
            processingStatus: "READY",
          },
        },
      });
      if (verifiedMediaCount === 0) return true;
    }
    return false;
  }

  public async recordActivity(input: {
    readonly companyId: TenantId;
    readonly interviewSessionId: InterviewSessionId;
    readonly candidateSessionId: CandidateSessionId | null;
    readonly type: InterviewActivityType;
    readonly at: Date;
    readonly metadata: Record<string, unknown>;
  }): Promise<void> {
    await prisma.interviewActivityEvent.create({
      data: {
        companyId: input.companyId,
        interviewSessionId: input.interviewSessionId,
        candidateSessionId: input.candidateSessionId,
        type: toPrismaActivityType(input.type),
        occurredAt: input.at,
        metadataJson: toInputJson(input.metadata),
      },
    });
  }

  public async createRecoveryCheckpoint(
    input: Parameters<InterviewRepository["createRecoveryCheckpoint"]>[0],
  ): Promise<InterviewRecoveryCheckpointId> {
    const created = await prisma.interviewRecoveryCheckpoint.create({
      data: {
        companyId: input.companyId,
        interviewSessionId: input.interviewSessionId,
        candidateSessionId: input.candidateSessionId,
        type: toPrismaRecoveryType(input.type),
        checkpointJson: toInputJson(input.checkpoint),
        expiresAt: input.expiresAt,
      },
    });
    return created.id as InterviewRecoveryCheckpointId;
  }

  public async resolveRecoveryCheckpoints(
    input: Parameters<InterviewRepository["resolveRecoveryCheckpoints"]>[0],
  ): Promise<void> {
    await prisma.interviewRecoveryCheckpoint.updateMany({
      where: {
        companyId: input.tenant.companyId,
        interviewSessionId: input.interviewSessionId,
        status: "OPEN",
        ...(input.type === undefined ? {} : { type: toPrismaRecoveryType(input.type) }),
      },
      data: { status: "RESOLVED", resolvedAt: input.resolvedAt },
    });
  }

  public async listOpenRecoveryCheckpoints(
    tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): ReturnType<InterviewRepository["listOpenRecoveryCheckpoints"]> {
    const records = await prisma.interviewRecoveryCheckpoint.findMany({
      where: { companyId: tenant.companyId, interviewSessionId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
    });
    return records.map((record) => ({
      id: record.id as InterviewRecoveryCheckpointId,
      type: fromPrismaRecoveryType(record.type),
      checkpoint: asRecord(record.checkpointJson),
      expiresAt: record.expiresAt,
    }));
  }

  public async recordStateHistory(
    input: Parameters<InterviewRepository["recordStateHistory"]>[0],
  ): Promise<void> {
    await prisma.interviewStateHistory.create({
      data: {
        companyId: input.companyId,
        interviewSessionId: input.interviewSessionId,
        fromStatus: input.fromStatus === null ? null : toPrismaSessionStatus(input.fromStatus),
        toStatus: toPrismaSessionStatus(input.toStatus),
        reason: input.reason,
        metadataJson: toInputJson(input.metadata),
      },
    });
  }

  public async markCandidateSessionInterview(input: {
    readonly session: CandidateSessionContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<void> {
    await prisma.candidateSession.update({
      where: { companyId_id: { companyId: input.session.companyId, id: input.session.sessionId } },
      data: { interviewSessionId: input.interviewSessionId, lastSeenAt: new Date() },
    });
  }
}

function projectQuestions(value: Prisma.JsonValue): readonly CandidateSafeQuestion[] {
  if (!Array.isArray(value)) {
    throw new InterviewDomainError(
      "Interview plan question blueprint is invalid.",
      "invalid_state",
    );
  }
  return value.map((item, index) => {
    const record = asRecord(item);
    const prompt = readString(record.prompt);
    if (prompt === null) {
      throw new InterviewDomainError(
        "Interview plan contains an invalid question.",
        "invalid_state",
      );
    }
    return {
      sequence: readNumber(record.sequence) ?? index + 1,
      key: readString(record.key) ?? `question-${String(index + 1)}`,
      kind: normalizeQuestionKind(readString(record.kind)),
      prompt,
      required: record.required !== false,
    };
  });
}

async function findActiveJobPlanVersionId(
  companyId: string,
  jobId: string,
): Promise<string | null> {
  const plan = await prisma.interviewPlan.findFirst({
    where: {
      companyId,
      jobId,
      status: "ACTIVE",
      activeVersionId: { not: null },
      deletedAt: null,
    },
    orderBy: { updatedAt: "desc" },
  });
  return plan?.activeVersionId ?? null;
}

function normalizeQuestionKind(value: string | null): InterviewQuestionKind {
  if (value === "opening" || value === "main" || value === "closing" || value === "follow_up") {
    return value;
  }
  return "main";
}

function mapSession(record: InterviewSession): InterviewSessionRecord {
  return {
    id: record.id as InterviewSessionId,
    companyId: record.companyId as TenantId,
    candidateId: record.candidateId,
    invitationId: record.invitationId as never,
    applicationId: record.applicationId,
    interviewPlanVersionId: record.interviewPlanVersionId,
    status: fromPrismaSessionStatus(record.status),
    startedAt: record.startedAt,
    interruptedAt: record.interruptedAt,
    completedAt: record.completedAt,
    lastActivityAt: record.lastActivityAt,
    durationSeconds: record.durationSeconds,
    currentQuestionSequence: record.currentQuestionSequence,
    resumeAllowedUntil: record.resumeAllowedUntil,
    processingWorkflowId: record.processingWorkflowId as never,
    planSnapshot:
      record.planSnapshotJson === null
        ? null
        : (record.planSnapshotJson as unknown as CandidateSafePlan),
    expiresAt: record.expiresAt,
    metadata: asRecord(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapQuestionState(record: InterviewQuestionState): InterviewQuestionStateRecord {
  return {
    id: record.id as InterviewQuestionStateId,
    companyId: record.companyId as TenantId,
    interviewSessionId: record.interviewSessionId as InterviewSessionId,
    sequence: record.sequence,
    questionKey: record.questionKey,
    kind: fromPrismaQuestionKind(record.kind),
    prompt: record.prompt,
    required: record.required,
    status: fromPrismaQuestionStatus(record.status),
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    metadata: asRecord(record.metadataJson),
  };
}

function mapTurn(record: InterviewTurn): InterviewTurnRecord {
  return {
    id: record.id as InterviewTurnId,
    companyId: record.companyId as TenantId,
    interviewSessionId: record.interviewSessionId as InterviewSessionId,
    questionStateId: record.questionStateId as InterviewQuestionStateId,
    sequence: record.sequence,
    attemptNumber: record.attemptNumber,
    speaker: fromPrismaTurnSpeaker(record.speaker),
    status: fromPrismaTurnStatus(record.status),
    content: record.content,
    idempotencyKey: record.idempotencyKey,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    confirmedAt: record.confirmedAt,
    metadata: asRecord(record.metadataJson),
  };
}

function mapTurnMedia(record: InterviewTurnMedia): InterviewTurnMediaRecord {
  return {
    id: record.id as never,
    companyId: record.companyId as TenantId,
    interviewSessionId: record.interviewSessionId as InterviewSessionId,
    interviewTurnId: record.interviewTurnId as InterviewTurnId,
    mediaObjectId: record.mediaObjectId as MediaObjectId,
    chunkSequence: record.chunkSequence,
    durationMs: record.durationMs,
    status: fromPrismaTurnMediaStatus(record.status),
    metadata: asRecord(record.metadataJson),
  };
}

function toPrismaSessionStatus(value: InterviewSessionStatus): InterviewSession["status"] {
  return value.toUpperCase() as InterviewSession["status"];
}

function fromPrismaSessionStatus(value: InterviewSession["status"]): InterviewSessionStatus {
  return value.toLowerCase() as InterviewSessionStatus;
}

function toPrismaQuestionKind(value: InterviewQuestionKind): InterviewQuestionState["kind"] {
  return value.toUpperCase() as InterviewQuestionState["kind"];
}

function fromPrismaQuestionKind(value: InterviewQuestionState["kind"]): InterviewQuestionKind {
  return value.toLowerCase() as InterviewQuestionKind;
}

function toPrismaQuestionStatus(value: InterviewQuestionStatus): InterviewQuestionState["status"] {
  return value.toUpperCase() as InterviewQuestionState["status"];
}

function fromPrismaQuestionStatus(
  value: InterviewQuestionState["status"],
): InterviewQuestionStatus {
  return value.toLowerCase() as InterviewQuestionStatus;
}

function toPrismaTurnSpeaker(value: InterviewTurnSpeaker): InterviewTurn["speaker"] {
  return value.toUpperCase() as InterviewTurn["speaker"];
}

function fromPrismaTurnSpeaker(value: InterviewTurn["speaker"]): InterviewTurnSpeaker {
  return value.toLowerCase() as InterviewTurnSpeaker;
}

function fromPrismaTurnStatus(value: InterviewTurn["status"]): InterviewTurnStatus {
  return value.toLowerCase() as InterviewTurnStatus;
}

function toPrismaTurnMediaStatus(value: InterviewTurnMediaStatus): InterviewTurnMedia["status"] {
  return value.toUpperCase() as InterviewTurnMedia["status"];
}

function fromPrismaTurnMediaStatus(value: InterviewTurnMedia["status"]): InterviewTurnMediaStatus {
  return value.toLowerCase() as InterviewTurnMediaStatus;
}

function toPrismaActivityType(value: InterviewActivityType): InterviewActivityEvent["type"] {
  return value.toUpperCase() as InterviewActivityEvent["type"];
}

function toPrismaRecoveryType(value: InterviewRecoveryType) {
  return value.toUpperCase() as "SESSION" | "INTERRUPTION" | "UPLOAD";
}

function fromPrismaRecoveryType(value: string): InterviewRecoveryType {
  return value.toLowerCase() as InterviewRecoveryType;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) > 0 ? (value as number) : null;
}

function toInputJson(value: Record<string, unknown> | CandidateSafePlan): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}
