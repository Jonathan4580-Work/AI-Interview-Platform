import { AuditWriter } from "@/modules/audit";

import type {
  CandidateInterviewContext,
  CandidateSafePlan,
  InterviewMutationContext,
  InterviewQuestionStateRecord,
  InterviewRepository,
  InterviewSessionRecord,
  InterviewSessionStatus,
  InterviewStartResult,
  InterviewStateView,
  InterviewTurnId,
} from "./types";
import type { MediaObjectId } from "@/modules/media";
import type { ProcessingWorkflowId, WorkflowService } from "@/modules/workflows";

const RESUME_WINDOW_MS = 30 * 60 * 1000;
const HEARTBEAT_INTERRUPT_MS = 90_000;
const TERMINAL_STATUSES: readonly InterviewSessionStatus[] = [
  "completed",
  "processing",
  "cancelled",
  "expired",
  "withdrawn",
];

export class InterviewDomainError extends Error {
  public constructor(
    message: string,
    public readonly code:
      "invalid_state" | "not_found" | "validation_failed" | "upload_recovery" | "forbidden",
  ) {
    super(message);
    this.name = "InterviewDomainError";
  }
}

export class InterviewService {
  public constructor(
    private readonly repository: InterviewRepository,
    private readonly auditWriter: AuditWriter,
    private readonly workflowService: WorkflowService | null = null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async startInterview(context: CandidateInterviewContext): Promise<InterviewStartResult> {
    const now = this.now();
    const existing = await this.repository.findSessionForCandidate({ session: context.session });
    if (existing !== null && TERMINAL_STATUSES.includes(existing.status)) {
      throw new InterviewDomainError(
        "Interview cannot be started from its current state.",
        "invalid_state",
      );
    }

    const plan = existing?.planSnapshot ?? (await this.repository.loadCandidateSafePlan(context));
    validatePlan(plan);
    const started = await this.repository.startSession({
      session: context.session,
      plan,
      now,
      resumeAllowedUntil: addMs(now, RESUME_WINDOW_MS),
    });
    await this.repository.markCandidateSessionInterview({
      session: context.session,
      interviewSessionId: started.session.id,
    });
    const questions = await this.repository.ensureQuestionStates({
      tenant: { companyId: context.session.companyId },
      interviewSessionId: started.session.id,
      questions: plan.questions,
    });
    await this.repository.recordActivity({
      companyId: context.session.companyId,
      interviewSessionId: started.session.id,
      candidateSessionId: context.session.sessionId,
      type: started.created ? "resumed" : "heartbeat",
      at: now,
      metadata: { action: "start_interview" },
    });
    if (started.created) {
      await this.auditCandidate(
        context,
        "interview.started",
        started.session,
        null,
        started.session,
      );
      await this.repository.recordStateHistory({
        companyId: context.session.companyId,
        interviewSessionId: started.session.id,
        fromStatus: null,
        toStatus: started.session.status,
        reason: "candidate_started",
        metadata: {},
      });
    }
    const view = await this.buildView({ ...started.session, planSnapshot: plan }, plan, questions);
    return { ...view, created: started.created };
  }

  public async getState(context: CandidateInterviewContext): Promise<InterviewStateView> {
    const session = await this.requireCandidateInterview(context);
    const plan = requirePlan(session);
    const questions = await this.repository.listQuestionStates(
      { companyId: context.session.companyId },
      session.id,
    );
    return this.buildView(session, plan, questions);
  }

  public async startQuestion(
    context: CandidateInterviewContext,
    sequence: number,
  ): Promise<InterviewQuestionStateRecord> {
    const session = await this.requireActiveInterview(context);
    const plan = requirePlan(session);
    const question = plan.questions.find((candidate) => candidate.sequence === sequence);
    if (question === undefined) {
      throw new InterviewDomainError(
        "Question is not part of this interview.",
        "validation_failed",
      );
    }
    if (session.currentQuestionSequence !== null && sequence < session.currentQuestionSequence) {
      throw new InterviewDomainError(
        "Completed interview questions cannot be reopened.",
        "invalid_state",
      );
    }
    const updated = await this.repository.updateQuestionStatus({
      tenant: { companyId: context.session.companyId },
      interviewSessionId: session.id,
      sequence,
      fromStatuses: ["pending", "active"],
      toStatus: "active",
      at: this.now(),
    });
    if (updated === null) {
      throw new InterviewDomainError(
        "Question cannot be started from its current state.",
        "invalid_state",
      );
    }
    await this.repository.updateSessionStatus({
      tenant: { companyId: context.session.companyId },
      sessionId: session.id,
      fromStatuses: ["in_progress", "interrupted"],
      toStatus: "in_progress",
      at: this.now(),
      currentQuestionSequence: sequence,
      resumeAllowedUntil: addMs(this.now(), RESUME_WINDOW_MS),
    });
    return updated;
  }

  public async startAnswer(input: {
    readonly context: CandidateInterviewContext;
    readonly sequence: number;
    readonly idempotencyKey: string;
  }) {
    const session = await this.requireActiveInterview(input.context);
    const question = await this.startQuestion(input.context, input.sequence);
    const existing = await this.repository.findTurnByIdempotency({
      companyId: input.context.session.companyId,
      idempotencyKey: scopedKey(input.context.session.sessionId, input.idempotencyKey),
    });
    if (existing !== null) {
      return existing;
    }
    const attempts = (
      await this.repository.listTurns({ companyId: input.context.session.companyId }, session.id)
    ).filter((turn) => turn.sequence === input.sequence);
    if (attempts.some((turn) => turn.status === "completed")) {
      throw new InterviewDomainError("This answer has already been submitted.", "invalid_state");
    }
    return this.repository.createTurn({
      companyId: input.context.session.companyId,
      interviewSessionId: session.id,
      questionStateId: question.id,
      sequence: input.sequence,
      attemptNumber: attempts.length + 1,
      speaker: "candidate",
      idempotencyKey: scopedKey(input.context.session.sessionId, input.idempotencyKey),
      startedAt: this.now(),
      metadata: {},
    });
  }

  public async completeAnswer(input: {
    readonly context: CandidateInterviewContext;
    readonly turnId: InterviewTurnId;
    readonly content?: string | null;
    readonly mediaObjectIds: readonly MediaObjectId[];
    readonly idempotencyKey: string;
  }) {
    const session = await this.requireActiveInterview(input.context);
    const turns = await this.repository.listTurns(
      { companyId: input.context.session.companyId },
      session.id,
    );
    const turn = turns.find((candidate) => candidate.id === input.turnId);
    if (turn === undefined) {
      throw new InterviewDomainError("Answer turn was not found.", "not_found");
    }
    if (turn.status === "completed") {
      return turn;
    }
    const completed = await this.repository.completeTurn({
      tenant: { companyId: input.context.session.companyId },
      turnId: input.turnId,
      content: sanitizeOptionalText(input.content ?? null, 10_000),
      endedAt: this.now(),
      metadata: {
        completionIdempotencyKey: scopedKey(input.context.session.sessionId, input.idempotencyKey),
      },
    });
    if (completed === null) {
      throw new InterviewDomainError(
        "Answer cannot be completed from its current state.",
        "invalid_state",
      );
    }
    let chunkSequence = 1;
    for (const mediaObjectId of input.mediaObjectIds) {
      await this.repository.attachTurnMedia({
        companyId: input.context.session.companyId,
        interviewSessionId: session.id,
        turnId: completed.id,
        mediaObjectId,
        chunkSequence,
        durationMs: null,
        status: "verified",
        metadata: {},
      });
      chunkSequence += 1;
    }
    await this.repository.updateQuestionStatus({
      tenant: { companyId: input.context.session.companyId },
      interviewSessionId: session.id,
      sequence: completed.sequence,
      fromStatuses: ["active"],
      toStatus: "answered",
      at: this.now(),
    });
    return completed;
  }

  public async heartbeat(input: {
    readonly context: CandidateInterviewContext;
    readonly connectionState: "ok" | "degraded" | "lost";
  }): Promise<InterviewSessionRecord> {
    const session = await this.requireCandidateInterview(input.context);
    const now = this.now();
    const shouldInterrupt =
      input.connectionState === "lost" &&
      session.lastActivityAt !== null &&
      now.getTime() - session.lastActivityAt.getTime() >= HEARTBEAT_INTERRUPT_MS;
    const nextStatus = shouldInterrupt ? "interrupted" : session.status;
    const updated = await this.repository.updateSessionStatus({
      tenant: { companyId: input.context.session.companyId },
      sessionId: session.id,
      fromStatuses: ["in_progress", "interrupted", "upload_recovery"],
      toStatus: nextStatus,
      at: now,
      resumeAllowedUntil: addMs(now, RESUME_WINDOW_MS),
    });
    if (updated === null) {
      return session;
    }
    await this.repository.recordActivity({
      companyId: input.context.session.companyId,
      interviewSessionId: session.id,
      candidateSessionId: input.context.session.sessionId,
      type: shouldInterrupt ? "interrupted" : "heartbeat",
      at: now,
      metadata: { connectionState: input.connectionState },
    });
    return updated;
  }

  public async resumeInterview(context: CandidateInterviewContext): Promise<InterviewStateView> {
    const session = await this.requireCandidateInterview(context);
    if (session.resumeAllowedUntil !== null && session.resumeAllowedUntil <= this.now()) {
      throw new InterviewDomainError("Interview resume window has expired.", "invalid_state");
    }
    const resumed = await this.repository.updateSessionStatus({
      tenant: { companyId: context.session.companyId },
      sessionId: session.id,
      fromStatuses: ["interrupted", "upload_recovery", "in_progress"],
      toStatus: session.status === "upload_recovery" ? "upload_recovery" : "in_progress",
      at: this.now(),
      resumeAllowedUntil: addMs(this.now(), RESUME_WINDOW_MS),
    });
    if (resumed === null) {
      throw new InterviewDomainError(
        "Interview cannot be resumed from its current state.",
        "invalid_state",
      );
    }
    await this.repository.recordActivity({
      companyId: context.session.companyId,
      interviewSessionId: resumed.id,
      candidateSessionId: context.session.sessionId,
      type: "resumed",
      at: this.now(),
      metadata: {},
    });
    return this.getState(context);
  }

  public async getUploadRecovery(context: CandidateInterviewContext) {
    const session = await this.requireCandidateInterview(context);
    const checkpoints = await this.repository.listOpenRecoveryCheckpoints(
      { companyId: context.session.companyId },
      session.id,
    );
    return { session, checkpoints };
  }

  public async completeInterview(
    context: CandidateInterviewContext,
  ): Promise<InterviewSessionRecord> {
    const session = await this.requireActiveInterview(context);
    const questions = await this.repository.listQuestionStates(
      { companyId: context.session.companyId },
      session.id,
    );
    const unanswered = questions.filter(
      (question) => question.required && question.status !== "answered",
    );
    if (unanswered.length > 0) {
      throw new InterviewDomainError(
        "Required questions must be answered before completion.",
        "invalid_state",
      );
    }
    const turns = await this.repository.listTurns(
      { companyId: context.session.companyId },
      session.id,
    );
    const media = await this.repository.listTurnMedia(
      { companyId: context.session.companyId },
      session.id,
    );
    const expectedMediaTurns = turns.filter(
      (turn) => turn.speaker === "candidate" && turn.status === "completed",
    );
    const missingMedia = expectedMediaTurns.some(
      (turn) =>
        !media.some((record) => record.interviewTurnId === turn.id && record.status === "verified"),
    );
    if (missingMedia) {
      await this.enterUploadRecovery(context, session, { reason: "required_media_pending" });
      throw new InterviewDomainError(
        "Required uploads must recover before completion.",
        "upload_recovery",
      );
    }

    const workflowId = await this.createProcessingWorkflow(context, session);
    const completed = await this.repository.updateSessionStatus({
      tenant: { companyId: context.session.companyId },
      sessionId: session.id,
      fromStatuses: ["in_progress", "interrupted", "upload_recovery"],
      toStatus: "completed",
      at: this.now(),
      processingWorkflowId: workflowId,
    });
    if (completed === null) {
      throw new InterviewDomainError(
        "Interview cannot be completed from its current state.",
        "invalid_state",
      );
    }
    await this.auditCandidate(context, "interview.completed", completed, session, completed);
    await this.repository.recordStateHistory({
      companyId: context.session.companyId,
      interviewSessionId: completed.id,
      fromStatus: session.status,
      toStatus: "completed",
      reason: "candidate_completed",
      metadata: { workflowId },
    });
    return completed;
  }

  public async inspectInterview(
    context: InterviewMutationContext,
    interviewSessionId: InterviewSessionRecord["id"],
  ): Promise<InterviewStateView> {
    const session = await this.repository.findSession(context.tenant, interviewSessionId);
    if (session === null) {
      throw new InterviewDomainError("Interview session was not found.", "not_found");
    }
    const plan = requirePlan(session);
    const questions = await this.repository.listQuestionStates(context.tenant, session.id);
    return this.buildView(session, plan, questions);
  }

  private async requireCandidateInterview(
    context: CandidateInterviewContext,
  ): Promise<InterviewSessionRecord> {
    const session = await this.repository.findSessionForCandidate({ session: context.session });
    if (session === null) {
      throw new InterviewDomainError("Interview has not started.", "not_found");
    }
    if (session.expiresAt <= this.now() || context.session.expiresAt <= this.now()) {
      throw new InterviewDomainError("Interview session has expired.", "invalid_state");
    }
    return session;
  }

  private async requireActiveInterview(
    context: CandidateInterviewContext,
  ): Promise<InterviewSessionRecord> {
    const session = await this.requireCandidateInterview(context);
    if (
      session.status !== "in_progress" &&
      session.status !== "interrupted" &&
      session.status !== "upload_recovery"
    ) {
      throw new InterviewDomainError("Interview is not active.", "invalid_state");
    }
    return session;
  }

  private async enterUploadRecovery(
    context: CandidateInterviewContext,
    session: InterviewSessionRecord,
    checkpoint: Record<string, unknown>,
  ): Promise<void> {
    await this.repository.updateSessionStatus({
      tenant: { companyId: context.session.companyId },
      sessionId: session.id,
      fromStatuses: ["in_progress", "interrupted", "upload_recovery"],
      toStatus: "upload_recovery",
      at: this.now(),
      resumeAllowedUntil: addMs(this.now(), RESUME_WINDOW_MS),
    });
    await this.repository.createRecoveryCheckpoint({
      companyId: context.session.companyId,
      interviewSessionId: session.id,
      candidateSessionId: context.session.sessionId,
      type: "upload",
      checkpoint,
      expiresAt: addMs(this.now(), RESUME_WINDOW_MS),
    });
    await this.repository.recordActivity({
      companyId: context.session.companyId,
      interviewSessionId: session.id,
      candidateSessionId: context.session.sessionId,
      type: "upload_recovery_started",
      at: this.now(),
      metadata: checkpoint,
    });
  }

  private async createProcessingWorkflow(
    context: CandidateInterviewContext,
    session: InterviewSessionRecord,
  ): Promise<ProcessingWorkflowId | null> {
    if (this.workflowService === null) {
      return session.processingWorkflowId;
    }
    const workflow = await this.workflowService.createWorkflow({
      context: {
        tenant: { companyId: context.session.companyId },
        actor: { type: "candidate_session", id: context.session.sessionId },
        request: context.request,
      },
      workflowType: "interview_processing",
      subjectType: "interview_session",
      subjectId: session.id,
      idempotencyKey: `interview-processing:${context.session.companyId}:${session.id}`,
      metadata: { phase: 7 },
      steps: [
        { stepKey: "finalize_media", queueName: "media", sequence: 1, maxAttempts: 3 },
        {
          stepKey: "transcribe_recording",
          queueName: "provider-bound",
          sequence: 2,
          dependencyStepKeys: ["finalize_media"],
          maxAttempts: 1,
        },
        {
          stepKey: "evaluate_interview",
          queueName: "provider-bound",
          sequence: 3,
          dependencyStepKeys: ["transcribe_recording"],
          maxAttempts: 1,
        },
        {
          stepKey: "generate_report",
          queueName: "reporting",
          sequence: 4,
          dependencyStepKeys: ["evaluate_interview"],
          maxAttempts: 1,
        },
      ],
    });
    return workflow.id;
  }

  private async buildView(
    session: InterviewSessionRecord,
    plan: CandidateSafePlan,
    questions: readonly InterviewQuestionStateRecord[],
  ): Promise<InterviewStateView> {
    const tenant = { companyId: session.companyId };
    return {
      session,
      plan,
      questions,
      turns: await this.repository.listTurns(tenant, session.id),
      media: await this.repository.listTurnMedia(tenant, session.id),
    };
  }

  private async auditCandidate(
    context: CandidateInterviewContext,
    action: string,
    resource: InterviewSessionRecord,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await this.auditWriter.record({
      companyId: context.session.companyId,
      actor: { type: "candidate_session", id: context.session.sessionId },
      request: context.request,
      action,
      resourceType: "interview_session",
      resourceId: resource.id,
      riskLevel: "medium",
      before,
      after,
    });
  }
}

function validatePlan(plan: CandidateSafePlan): void {
  if (plan.questions.length === 0) {
    throw new InterviewDomainError(
      "Interview plan has no candidate-safe questions.",
      "invalid_state",
    );
  }
  const sequences = new Set<number>();
  for (const question of plan.questions) {
    if (sequences.has(question.sequence) || question.sequence < 1) {
      throw new InterviewDomainError("Interview plan question order is invalid.", "invalid_state");
    }
    sequences.add(question.sequence);
    if (question.prompt.trim().length === 0) {
      throw new InterviewDomainError("Interview plan question prompt is invalid.", "invalid_state");
    }
  }
}

function requirePlan(session: InterviewSessionRecord): CandidateSafePlan {
  if (session.planSnapshot === null) {
    throw new InterviewDomainError("Interview plan snapshot is missing.", "invalid_state");
  }
  return session.planSnapshot;
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

function scopedKey(sessionId: string, key: string): string {
  const normalized = key.trim();
  if (!/^[a-zA-Z0-9_.:-]{1,120}$/u.test(normalized)) {
    throw new InterviewDomainError("Idempotency key is invalid.", "validation_failed");
  }
  return `${sessionId}:${normalized}`;
}

function sanitizeOptionalText(value: string | null, maxLength: number): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maxLength) {
    throw new InterviewDomainError("Answer text is too long.", "validation_failed");
  }
  return normalized;
}
