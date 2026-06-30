import { describe, expect, it } from "vitest";

import { AuditWriter, type AuditEventStore, type PersistedAuditEventInput } from "@/modules/audit";
import { InterviewDomainError, InterviewService } from "@/modules/interviews";

import type {
  CandidateSafePlan,
  InterviewQuestionStateRecord,
  InterviewRepository,
  InterviewSessionRecord,
  InterviewTurnMediaRecord,
  InterviewTurnRecord,
} from "@/modules/interviews";
import type { CandidateSessionContext, CandidateSessionId } from "@/modules/candidate-portal";
import type { CandidateInvitationId, InterviewSessionId } from "@/modules/invitations";
import type { MediaObjectId } from "@/modules/media";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { ProcessingWorkflowId, WorkflowService } from "@/modules/workflows";

describe("browser interview session service", () => {
  it("starts interviews idempotently and snapshots candidate-safe plan questions", async () => {
    const repo = new InMemoryInterviewRepository();
    const service = createService(repo);

    const first = await service.startInterview(candidateContext);
    const second = await service.startInterview(candidateContext);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(repo.sessions).toHaveLength(1);
    expect(first.plan.questions.map((question) => question.prompt)).toEqual([
      "Welcome. What should we know before we begin?",
      "Tell us about a recent project.",
      "What questions do you have for us?",
    ]);
  });

  it("requires readiness and consent before starting an interview", async () => {
    const repo = new InMemoryInterviewRepository();
    repo.prepared = false;
    const service = createService(repo);

    await expect(service.startInterview(candidateContext)).rejects.toMatchObject({
      code: "invalid_state",
    });
    expect(repo.sessions).toHaveLength(0);
  });

  it("prevents duplicate final answer submission for the same sequence", async () => {
    const repo = new InMemoryInterviewRepository();
    const service = createService(repo);
    await service.startInterview(candidateContext);

    const turn = await service.startAnswer({
      context: candidateContext,
      sequence: 1,
      idempotencyKey: "answer-1",
    });
    await repo.attachTurnMedia({
      companyId: tenant.companyId,
      interviewSessionId: turn.interviewSessionId,
      turnId: turn.id,
      mediaObjectId: "media_1" as MediaObjectId,
      chunkSequence: 1,
      durationMs: 1000,
      status: "verified",
      metadata: {},
    });
    await service.completeAnswer({
      context: candidateContext,
      turnId: turn.id,
      content: null,
      mediaObjectIds: ["media_1" as MediaObjectId],
      idempotencyKey: "complete-1",
    });

    await expect(
      service.startAnswer({
        context: candidateContext,
        sequence: 1,
        idempotencyKey: "answer-1-again",
      }),
    ).rejects.toThrow(InterviewDomainError);
  });

  it("prevents skipping ahead in the question sequence", async () => {
    const repo = new InMemoryInterviewRepository();
    const service = createService(repo);
    await service.startInterview(candidateContext);

    await expect(service.startQuestion(candidateContext, 2)).rejects.toMatchObject({
      code: "invalid_state",
    });
  });

  it("moves to upload recovery when completion is attempted before media is verified", async () => {
    const repo = new InMemoryInterviewRepository();
    const service = createService(repo);
    await service.startInterview(candidateContext);
    for (const sequence of [1, 2, 3]) {
      const turn = await service.startAnswer({
        context: candidateContext,
        sequence,
        idempotencyKey: `answer-${String(sequence)}`,
      });
      await service.completeAnswer({
        context: candidateContext,
        turnId: turn.id,
        content: null,
        mediaObjectIds: [],
        idempotencyKey: `complete-${String(sequence)}`,
      });
    }

    await expect(service.completeInterview(candidateContext)).rejects.toMatchObject({
      code: "upload_recovery",
    });
    expect(repo.sessions[0]?.status).toBe("upload_recovery");
    expect(repo.recoveryCheckpoints).toHaveLength(1);
  });

  it("moves to upload recovery when linked media loses verified storage state", async () => {
    const repo = new InMemoryInterviewRepository();
    repo.mediaObjectsVerified = false;
    const service = createService(repo);
    await service.startInterview(candidateContext);
    for (const sequence of [1, 2, 3]) {
      const turn = await service.startAnswer({
        context: candidateContext,
        sequence,
        idempotencyKey: `answer-${String(sequence)}`,
      });
      await service.completeAnswer({
        context: candidateContext,
        turnId: turn.id,
        content: null,
        mediaObjectIds: [`media_${String(sequence)}` as MediaObjectId],
        idempotencyKey: `complete-${String(sequence)}`,
      });
    }

    await expect(service.completeInterview(candidateContext)).rejects.toMatchObject({
      code: "upload_recovery",
    });
    expect(repo.sessions[0]?.status).toBe("upload_recovery");
  });

  it("creates a processing workflow after required answers and media are complete", async () => {
    const repo = new InMemoryInterviewRepository();
    const workflow = new FakeWorkflowService();
    const service = createService(repo, workflow as unknown as WorkflowService);
    await service.startInterview(candidateContext);
    for (const sequence of [1, 2, 3]) {
      const turn = await service.startAnswer({
        context: candidateContext,
        sequence,
        idempotencyKey: `answer-${String(sequence)}`,
      });
      await service.completeAnswer({
        context: candidateContext,
        turnId: turn.id,
        content: null,
        mediaObjectIds: [`media_${String(sequence)}` as MediaObjectId],
        idempotencyKey: `complete-${String(sequence)}`,
      });
    }

    const completed = await service.completeInterview(candidateContext);

    expect(completed.status).toBe("completed");
    expect(workflow.createdWorkflow?.workflowType).toBe("interview_processing");
    expect(workflow.createdWorkflow?.steps.map((step) => step.stepKey)).toEqual([
      "finalize_media",
      "transcribe_recording",
      "evaluate_interview",
      "generate_report",
    ]);

    const secondCompletion = await service.completeInterview(candidateContext);
    expect(secondCompletion.id).toBe(completed.id);
    expect(workflow.createCount).toBe(1);
  });
});

const tenant: TenantContext = { companyId: "company_test" as TenantId };
const session: CandidateSessionContext = {
  companyId: tenant.companyId,
  sessionId: "candidate_session_1" as CandidateSessionId,
  candidateId: "candidate_1",
  invitationId: "invitation_1",
  interviewSessionId: null,
  expiresAt: new Date("2026-06-30T03:00:00.000Z"),
  csrfTokenHash: "csrf_hash",
};
const candidateContext = {
  session,
  request: {
    requestId: "req_1",
    correlationId: "corr_1",
    sessionId: session.sessionId,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  },
};
const plan: CandidateSafePlan = {
  versionId: "plan_version_1",
  versionNumber: 1,
  durationMinutes: 30,
  questions: [
    {
      sequence: 1,
      key: "opening",
      kind: "opening",
      prompt: "Welcome. What should we know before we begin?",
      required: true,
    },
    {
      sequence: 2,
      key: "main-1",
      kind: "main",
      prompt: "Tell us about a recent project.",
      required: true,
    },
    {
      sequence: 3,
      key: "closing",
      kind: "closing",
      prompt: "What questions do you have for us?",
      required: true,
    },
  ],
};

function createService(repo: InMemoryInterviewRepository, workflow: WorkflowService | null = null) {
  return new InterviewService(
    repo,
    new AuditWriter(new InMemoryAuditStore()),
    workflow,
    () => new Date("2026-06-30T00:00:00.000Z"),
  );
}

class InMemoryAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class FakeWorkflowService {
  public createCount = 0;
  public createdWorkflow: {
    readonly workflowType: string;
    readonly steps: readonly { readonly stepKey: string }[];
  } | null = null;

  public createWorkflow(input: {
    readonly workflowType: string;
    readonly steps: readonly { readonly stepKey: string }[];
  }): Promise<{ readonly id: ProcessingWorkflowId }> {
    this.createCount += 1;
    this.createdWorkflow = { workflowType: input.workflowType, steps: input.steps };
    return Promise.resolve({ id: "workflow_1" as ProcessingWorkflowId });
  }
}

class InMemoryInterviewRepository implements InterviewRepository {
  public readonly sessions: InterviewSessionRecord[] = [];
  public readonly questions: InterviewQuestionStateRecord[] = [];
  public readonly turns: InterviewTurnRecord[] = [];
  public readonly media: InterviewTurnMediaRecord[] = [];
  public readonly recoveryCheckpoints: unknown[] = [];
  public prepared = true;
  public mediaObjectsVerified = true;

  public findSession(
    _tenant: TenantContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<InterviewSessionRecord | null> {
    return Promise.resolve(
      this.sessions.find((record) => record.id === interviewSessionId) ?? null,
    );
  }

  public findSessionForCandidate(): Promise<InterviewSessionRecord | null> {
    return Promise.resolve(this.sessions[0] ?? null);
  }

  public loadCandidateSafePlan(): Promise<CandidateSafePlan> {
    return Promise.resolve(plan);
  }

  public assertCandidatePrepared(): Promise<void> {
    if (!this.prepared) {
      return Promise.reject(
        new InterviewDomainError(
          "Candidate readiness must be completed before starting.",
          "invalid_state",
        ),
      );
    }
    return Promise.resolve();
  }

  public startSession(input: Parameters<InterviewRepository["startSession"]>[0]) {
    const existing = this.sessions.at(0);
    if (existing !== undefined) {
      return Promise.resolve({
        session: existing,
        created: false,
      });
    }
    const created = createSessionRecord({
      id: "interview_1" as InterviewSessionId,
      status: "in_progress",
      planSnapshot: input.plan,
      startedAt: input.now,
      lastActivityAt: input.now,
      resumeAllowedUntil: input.resumeAllowedUntil,
      currentQuestionSequence: 1,
    });
    this.sessions.push(created);
    return Promise.resolve({ session: created, created: true });
  }

  public updateSessionStatus(input: Parameters<InterviewRepository["updateSessionStatus"]>[0]) {
    const index = this.sessions.findIndex(
      (record) => record.id === input.sessionId && input.fromStatuses.includes(record.status),
    );
    if (index < 0) return Promise.resolve(null);
    const updated = {
      ...this.sessions[index],
      status: input.toStatus,
      lastActivityAt: input.at,
      completedAt:
        input.toStatus === "completed" ? input.at : (this.sessions[index]?.completedAt ?? null),
      currentQuestionSequence:
        input.currentQuestionSequence === undefined
          ? (this.sessions[index]?.currentQuestionSequence ?? null)
          : input.currentQuestionSequence,
      resumeAllowedUntil:
        input.resumeAllowedUntil === undefined
          ? (this.sessions[index]?.resumeAllowedUntil ?? null)
          : input.resumeAllowedUntil,
      processingWorkflowId:
        input.processingWorkflowId === undefined
          ? (this.sessions[index]?.processingWorkflowId ?? null)
          : input.processingWorkflowId,
    } satisfies InterviewSessionRecord;
    this.sessions[index] = updated;
    return Promise.resolve(updated);
  }

  public ensureQuestionStates(input: Parameters<InterviewRepository["ensureQuestionStates"]>[0]) {
    if (this.questions.length === 0) {
      this.questions.push(
        ...input.questions.map((question) => ({
          id: `question_${String(question.sequence)}` as never,
          companyId: tenant.companyId,
          interviewSessionId: input.interviewSessionId,
          sequence: question.sequence,
          questionKey: question.key,
          kind: question.kind,
          prompt: question.prompt,
          required: question.required,
          status: "pending" as const,
          startedAt: null,
          completedAt: null,
          metadata: {},
        })),
      );
    }
    return Promise.resolve(this.questions);
  }

  public listQuestionStates(): Promise<readonly InterviewQuestionStateRecord[]> {
    return Promise.resolve(this.questions);
  }

  public updateQuestionStatus(input: Parameters<InterviewRepository["updateQuestionStatus"]>[0]) {
    const index = this.questions.findIndex(
      (record) => record.sequence === input.sequence && input.fromStatuses.includes(record.status),
    );
    if (index < 0) return Promise.resolve(null);
    const updated = {
      ...this.questions[index],
      status: input.toStatus,
      startedAt:
        input.toStatus === "active"
          ? (this.questions[index]?.startedAt ?? input.at)
          : (this.questions[index]?.startedAt ?? null),
      completedAt:
        input.toStatus === "answered" ? input.at : (this.questions[index]?.completedAt ?? null),
    } satisfies InterviewQuestionStateRecord;
    this.questions[index] = updated;
    return Promise.resolve(updated);
  }

  public findTurnByIdempotency(input: Parameters<InterviewRepository["findTurnByIdempotency"]>[0]) {
    return Promise.resolve(
      this.turns.find((record) => record.idempotencyKey === input.idempotencyKey) ?? null,
    );
  }

  public createTurn(input: Parameters<InterviewRepository["createTurn"]>[0]) {
    const created: InterviewTurnRecord = {
      id: `turn_${String(this.turns.length + 1)}` as never,
      companyId: input.companyId,
      interviewSessionId: input.interviewSessionId,
      questionStateId: input.questionStateId,
      sequence: input.sequence,
      attemptNumber: input.attemptNumber,
      speaker: input.speaker,
      status: "started",
      content: null,
      idempotencyKey: input.idempotencyKey,
      startedAt: input.startedAt,
      endedAt: null,
      confirmedAt: null,
      metadata: input.metadata,
    };
    this.turns.push(created);
    return Promise.resolve(created);
  }

  public completeTurn(input: Parameters<InterviewRepository["completeTurn"]>[0]) {
    const index = this.turns.findIndex((record) => record.id === input.turnId);
    if (index < 0) return Promise.resolve(null);
    const updated = {
      ...this.turns[index],
      status: "completed",
      content: input.content,
      endedAt: input.endedAt,
      confirmedAt: input.endedAt,
      metadata: input.metadata,
    } satisfies InterviewTurnRecord;
    this.turns[index] = updated;
    return Promise.resolve(updated);
  }

  public listTurns(): Promise<readonly InterviewTurnRecord[]> {
    return Promise.resolve(this.turns);
  }

  public attachTurnMedia(input: Parameters<InterviewRepository["attachTurnMedia"]>[0]) {
    const record: InterviewTurnMediaRecord = {
      id: `turn_media_${String(this.media.length + 1)}` as never,
      companyId: input.companyId,
      interviewSessionId: input.interviewSessionId,
      interviewTurnId: input.turnId,
      mediaObjectId: input.mediaObjectId,
      chunkSequence: input.chunkSequence,
      durationMs: input.durationMs,
      status: input.status,
      metadata: input.metadata,
    };
    this.media.push(record);
    return Promise.resolve(record);
  }

  public listTurnMedia(): Promise<readonly InterviewTurnMediaRecord[]> {
    return Promise.resolve(this.media);
  }

  public hasUnverifiedRequiredMedia(): Promise<boolean> {
    return Promise.resolve(!this.mediaObjectsVerified);
  }

  public recordActivity(): Promise<void> {
    return Promise.resolve();
  }

  public createRecoveryCheckpoint(
    input: Parameters<InterviewRepository["createRecoveryCheckpoint"]>[0],
  ) {
    this.recoveryCheckpoints.push(input);
    return Promise.resolve("checkpoint_1" as never);
  }

  public resolveRecoveryCheckpoints(): Promise<void> {
    return Promise.resolve();
  }

  public listOpenRecoveryCheckpoints(): ReturnType<
    InterviewRepository["listOpenRecoveryCheckpoints"]
  > {
    return Promise.resolve([]);
  }

  public recordStateHistory(): Promise<void> {
    return Promise.resolve();
  }

  public markCandidateSessionInterview(): Promise<void> {
    return Promise.resolve();
  }
}

function createSessionRecord(
  overrides: Partial<InterviewSessionRecord> & { readonly id: InterviewSessionId },
): InterviewSessionRecord {
  const now = new Date("2026-06-30T00:00:00.000Z");
  return {
    id: overrides.id,
    companyId: tenant.companyId,
    candidateId: "candidate_1",
    invitationId: session.invitationId as CandidateInvitationId,
    applicationId: null,
    interviewPlanVersionId: plan.versionId,
    status: overrides.status ?? "not_started",
    startedAt: overrides.startedAt ?? null,
    interruptedAt: overrides.interruptedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    lastActivityAt: overrides.lastActivityAt ?? null,
    durationSeconds: overrides.durationSeconds ?? null,
    currentQuestionSequence: overrides.currentQuestionSequence ?? null,
    resumeAllowedUntil: overrides.resumeAllowedUntil ?? null,
    processingWorkflowId: overrides.processingWorkflowId ?? null,
    planSnapshot: overrides.planSnapshot ?? null,
    expiresAt: new Date("2026-06-30T03:00:00.000Z"),
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}
