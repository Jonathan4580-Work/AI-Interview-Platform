import { describe, expect, it } from "vitest";

import { AuditWriter, type AuditEventStore, type PersistedAuditEventInput } from "@/modules/audit";
import { WorkflowDomainError, WorkflowService } from "@/modules/workflows";
import type {
  ProcessingWorkflowId,
  ProcessingWorkflowRecord,
  ProcessingWorkflowStepId,
  ProcessingWorkflowStepRecord,
  WorkflowDeadLetterJobId,
  WorkflowDeadLetterJobRecord,
  WorkflowDeadLetterStatus,
  WorkflowFailureKind,
  WorkflowRepository,
  WorkflowStatus,
  WorkflowStepAttemptRecord,
  WorkflowStepDefinition,
  WorkflowStepStatus,
} from "@/modules/workflows";
import type { TenantContext, TenantId } from "@/modules/tenant";

describe("workflow orchestration", () => {
  it("creates workflows idempotently and keeps queue payload metadata out of the domain record", async () => {
    const repo = new InMemoryWorkflowRepository();
    const audit = new InMemoryAuditStore();
    const service = createService(repo, audit);

    const first = await service.createWorkflow({
      context,
      workflowType: "interview.processing",
      subjectType: "interview_session",
      subjectId: "session_1",
      idempotencyKey: "workflow:session_1",
      steps: defaultSteps,
    });
    const second = await service.createWorkflow({
      context,
      workflowType: "interview.processing",
      subjectType: "interview_session",
      subjectId: "session_1",
      idempotencyKey: "workflow:session_1",
      steps: defaultSteps,
    });

    expect(second.id).toBe(first.id);
    expect(repo.workflows).toHaveLength(1);
    expect(JSON.stringify(first.metadata)).not.toContain("https://");
    expect(audit.events.map((event) => event.action)).toEqual(["workflow.created"]);
  });

  it("queues only steps whose dependencies have succeeded", async () => {
    const repo = new InMemoryWorkflowRepository();
    const service = createService(repo);
    const workflow = await createDefaultWorkflow(service);

    let queued = await service.queueReadySteps({ context, workflowId: workflow.id });
    expect(queued.map((step) => step.stepKey)).toEqual(["finalize_media"]);

    const firstStep = queued.at(0);
    if (firstStep === undefined) throw new Error("Expected first step.");
    await service.startStep({ context, stepId: firstStep.id });
    await service.completeStep({ context, stepId: firstStep.id });
    expect(repo.attempts).toHaveLength(1);
    expect(repo.attempts[0]?.status).toBe("succeeded");
    expect(repo.attempts[0]?.completedAt).not.toBeNull();

    queued = await service.queueReadySteps({ context, workflowId: workflow.id });
    expect(queued.map((step) => step.stepKey)).toEqual(["notify_ready"]);
  });

  it("distinguishes retryable and terminal failures", async () => {
    const repo = new InMemoryWorkflowRepository();
    const service = createService(repo);
    const workflow = await createDefaultWorkflow(service, [
      {
        stepKey: "finalize_media",
        queueName: "media",
        sequence: 1,
        maxAttempts: 2,
      },
    ]);
    const queued = (await service.queueReadySteps({ context, workflowId: workflow.id })).at(0);
    if (queued === undefined) throw new Error("Expected queued step.");
    const running = await service.startStep({ context, stepId: queued.id });

    const retry = await service.failStep({
      context,
      stepId: running.id,
      failureKind: "retryable",
      errorCode: "OBJECT_NOT_READY",
      errorMessage: "Object storage has not confirmed the object yet.",
      retryAfterMs: 1_000,
    });
    expect(retry.status).toBe("retry_scheduled");
    expect(repo.attempts[0]?.status).toBe("failed");
    expect(repo.attempts[0]?.completedAt).not.toBeNull();
    expect(repo.workflows[0]?.status).toBe("running");

    const rerun = await service.startStep({ context, stepId: retry.id });
    const terminal = await service.failStep({
      context,
      stepId: rerun.id,
      failureKind: "terminal",
      errorCode: "CHECKSUM_MISMATCH",
      errorMessage: "Object checksum did not match the expected checksum.",
    });
    expect(terminal.status).toBe("failed");
    expect(repo.attempts[1]?.status).toBe("failed");
    expect(repo.attempts[1]?.completedAt).not.toBeNull();
    expect(repo.workflows[0]?.status).toBe("failed");
  });

  it("ignores stale failure after a step has already succeeded", async () => {
    const repo = new InMemoryWorkflowRepository();
    const service = createService(repo);
    const workflow = await createDefaultWorkflow(service, [
      {
        stepKey: "finalize_media",
        queueName: "media",
        sequence: 1,
      },
    ]);
    const queued = (await service.queueReadySteps({ context, workflowId: workflow.id })).at(0);
    if (queued === undefined) throw new Error("Expected queued step.");
    const running = await service.startStep({ context, stepId: queued.id });
    const succeeded = await service.completeStep({ context, stepId: running.id });

    const stale = await service.failStep({
      context,
      stepId: running.id,
      failureKind: "retryable",
      errorCode: "STALE_ERROR",
      errorMessage: "A stale worker failure arrived after success.",
    });

    expect(stale.status).toBe("succeeded");
    expect(repo.steps.find((step) => step.id === succeeded.id)?.status).toBe("succeeded");
    expect(repo.attempts).toHaveLength(1);
    expect(repo.attempts[0]?.status).toBe("succeeded");
  });

  it("does not crash when a running attempt for the same attempt number already exists", async () => {
    const repo = new InMemoryWorkflowRepository();
    const service = createService(repo);
    const workflow = await createDefaultWorkflow(service, [
      {
        stepKey: "finalize_media",
        queueName: "media",
        sequence: 1,
      },
    ]);
    const queued = (await service.queueReadySteps({ context, workflowId: workflow.id })).at(0);
    if (queued === undefined) throw new Error("Expected queued step.");

    const running = await service.startStep({ context, stepId: queued.id });
    await repo.upsertAttemptStarted({
      companyId: context.tenant.companyId,
      workflowId: running.workflowId,
      stepId: running.id,
      attemptNumber: running.attemptCount,
      startedAt: new Date("2026-06-30T00:00:00.000Z"),
      checkpoint: {},
      metadata: {},
    });
    await service.completeStep({ context, stepId: running.id });

    expect(repo.attempts).toHaveLength(1);
    expect(repo.attempts[0]?.attemptNumber).toBe(1);
    expect(repo.attempts[0]?.status).toBe("succeeded");
    expect(repo.attempts[0]?.completedAt).not.toBeNull();
  });

  it("progresses a full interview workflow through all processing steps", async () => {
    const repo = new InMemoryWorkflowRepository();
    const service = createService(repo);
    const workflow = await createDefaultWorkflow(service, [
      { stepKey: "finalize_media", queueName: "media", sequence: 1 },
      {
        stepKey: "transcribe_recording",
        queueName: "transcription",
        sequence: 2,
        dependencyStepKeys: ["finalize_media"],
      },
      {
        stepKey: "evaluate_interview",
        queueName: "evaluation",
        sequence: 3,
        dependencyStepKeys: ["transcribe_recording"],
      },
      {
        stepKey: "generate_report",
        queueName: "reporting",
        sequence: 4,
        dependencyStepKeys: ["evaluate_interview"],
      },
      {
        stepKey: "notify_results_ready",
        queueName: "notifications",
        sequence: 5,
        dependencyStepKeys: ["generate_report"],
      },
    ]);

    for (const expectedKey of [
      "finalize_media",
      "transcribe_recording",
      "evaluate_interview",
      "generate_report",
      "notify_results_ready",
    ]) {
      const queued = (await service.queueReadySteps({ context, workflowId: workflow.id })).at(0);
      expect(queued?.stepKey).toBe(expectedKey);
      if (queued === undefined) throw new Error(`Expected ${expectedKey}.`);
      const running = await service.startStep({ context, stepId: queued.id });
      await service.completeStep({ context, stepId: running.id });
    }

    expect(repo.steps.every((step) => step.status === "succeeded")).toBe(true);
    expect(repo.attempts).toHaveLength(5);
    expect(repo.attempts.every((attempt) => attempt.status === "succeeded")).toBe(true);
    expect(repo.attempts.every((attempt) => attempt.completedAt !== null)).toBe(true);
    expect(repo.workflows[0]?.status).toBe("completed");
  });

  it("rejects invalid dependency ordering", async () => {
    const service = createService(new InMemoryWorkflowRepository());

    await expect(
      service.createWorkflow({
        context,
        workflowType: "interview.processing",
        subjectType: "interview_session",
        subjectId: "session_1",
        idempotencyKey: "workflow:bad",
        steps: [
          {
            stepKey: "later",
            queueName: "media",
            sequence: 1,
            dependencyStepKeys: ["earlier"],
          },
          {
            stepKey: "earlier",
            queueName: "media",
            sequence: 2,
          },
        ],
      }),
    ).rejects.toThrow(WorkflowDomainError);
  });

  it("audits manual replay and cancellation", async () => {
    const repo = new InMemoryWorkflowRepository();
    const audit = new InMemoryAuditStore();
    const service = createService(repo, audit);
    const workflow = await createDefaultWorkflow(service, [
      {
        stepKey: "finalize_media",
        queueName: "media",
        sequence: 1,
      },
    ]);
    const queued = (await service.queueReadySteps({ context, workflowId: workflow.id })).at(0);
    if (queued === undefined) throw new Error("Expected queued step.");
    const running = await service.startStep({ context, stepId: queued.id });
    const failed = await service.failStep({
      context,
      stepId: running.id,
      failureKind: "terminal",
      errorCode: "PROVIDER_FATAL",
      errorMessage: "Provider rejected the workflow operation.",
    });

    await service.replayStep({ context, stepId: failed.id, reason: "Operator verified fix." });
    await service.cancelWorkflow({
      context,
      workflowId: workflow.id,
      reason: "Customer requested cancellation.",
    });

    expect(audit.events.map((event) => event.action)).toEqual([
      "workflow.created",
      "workflow.step_replayed",
      "workflow.cancelled",
    ]);
  });
});

const tenant: TenantContext = { companyId: "company_test" as TenantId };

const context = {
  tenant,
  actor: { type: "user" as const, id: "user_1" },
  request: {
    requestId: "req_1",
    correlationId: "corr_1",
    sessionId: "session_1",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  },
};

const defaultSteps: readonly WorkflowStepDefinition[] = [
  {
    stepKey: "finalize_media",
    queueName: "media",
    sequence: 1,
    maxAttempts: 3,
  },
  {
    stepKey: "notify_ready",
    queueName: "notifications",
    sequence: 2,
    dependencyStepKeys: ["finalize_media"],
  },
];

function createService(repo: InMemoryWorkflowRepository, audit = new InMemoryAuditStore()) {
  return new WorkflowService(
    repo,
    new AuditWriter(audit),
    () => new Date("2026-06-30T00:00:00.000Z"),
  );
}

async function createDefaultWorkflow(
  service: WorkflowService,
  steps: readonly WorkflowStepDefinition[] = defaultSteps,
): Promise<ProcessingWorkflowRecord> {
  return service.createWorkflow({
    context,
    workflowType: "interview.processing",
    subjectType: "interview_session",
    subjectId: "session_1",
    idempotencyKey: `workflow:${String(Math.random())}`,
    steps,
  });
}

class InMemoryAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class InMemoryWorkflowRepository implements WorkflowRepository {
  public readonly workflows: ProcessingWorkflowRecord[] = [];
  public readonly steps: ProcessingWorkflowStepRecord[] = [];
  public readonly attempts: WorkflowStepAttemptRecord[] = [];
  public readonly deadLetters: WorkflowDeadLetterJobRecord[] = [];

  public findWorkflowByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<ProcessingWorkflowRecord | null> {
    return Promise.resolve(
      this.workflows.find(
        (workflow) =>
          workflow.companyId === input.companyId &&
          workflow.idempotencyKey === input.idempotencyKey,
      ) ?? null,
    );
  }

  public findWorkflow(
    tenant: TenantContext,
    id: ProcessingWorkflowId,
  ): Promise<ProcessingWorkflowRecord | null> {
    return Promise.resolve(
      this.workflows.find(
        (workflow) => workflow.companyId === tenant.companyId && workflow.id === id,
      ) ?? null,
    );
  }

  public listWorkflows(input: {
    readonly tenant: TenantContext;
    readonly status?: WorkflowStatus;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<readonly ProcessingWorkflowRecord[]> {
    return Promise.resolve(
      this.workflows
        .filter(
          (workflow) =>
            workflow.companyId === input.tenant.companyId &&
            (input.status === undefined || workflow.status === input.status),
        )
        .slice(0, input.limit),
    );
  }

  public createWorkflow(input: {
    readonly companyId: TenantId;
    readonly workflowType: string;
    readonly subjectType: string;
    readonly subjectId: string;
    readonly idempotencyKey: string;
    readonly requestId: string | null;
    readonly correlationId: string | null;
    readonly metadata: Record<string, unknown>;
    readonly steps: readonly WorkflowStepDefinition[];
  }): Promise<{
    readonly workflow: ProcessingWorkflowRecord;
    readonly steps: readonly ProcessingWorkflowStepRecord[];
  }> {
    const now = new Date("2026-06-30T00:00:00.000Z");
    const workflow: ProcessingWorkflowRecord = {
      id: `workflow_${String(this.workflows.length + 1)}` as ProcessingWorkflowId,
      companyId: input.companyId,
      workflowType: input.workflowType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      status: "pending",
      idempotencyKey: input.idempotencyKey,
      currentStepKey: null,
      requestId: input.requestId,
      correlationId: input.correlationId,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      failureKind: null,
      failureCode: null,
      failureMessage: null,
      checkpoint: {},
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };
    const steps = input.steps.map((step, index) =>
      createStepRecord({
        ...step,
        companyId: input.companyId,
        workflowId: workflow.id,
        id: `step_${String(this.steps.length + index + 1)}` as ProcessingWorkflowStepId,
        idempotencyKey: `${input.idempotencyKey}:${step.stepKey}`,
      }),
    );
    this.workflows.push(workflow);
    this.steps.push(...steps);
    return Promise.resolve({ workflow, steps });
  }

  public listSteps(
    tenant: TenantContext,
    workflowId: ProcessingWorkflowId,
  ): Promise<readonly ProcessingWorkflowStepRecord[]> {
    return Promise.resolve(
      this.steps
        .filter((step) => step.companyId === tenant.companyId && step.workflowId === workflowId)
        .sort((left, right) => left.sequence - right.sequence),
    );
  }

  public findStep(
    tenant: TenantContext,
    stepId: ProcessingWorkflowStepId,
  ): Promise<ProcessingWorkflowStepRecord | null> {
    return Promise.resolve(
      this.steps.find((step) => step.companyId === tenant.companyId && step.id === stepId) ?? null,
    );
  }

  public updateWorkflowStatus(input: {
    readonly tenant: TenantContext;
    readonly workflowId: ProcessingWorkflowId;
    readonly fromStatuses: readonly WorkflowStatus[];
    readonly toStatus: WorkflowStatus;
    readonly currentStepKey?: string | null;
    readonly failureKind?: WorkflowFailureKind | null;
    readonly failureCode?: string | null;
    readonly failureMessage?: string | null;
    readonly at: Date;
  }): Promise<ProcessingWorkflowRecord | null> {
    const index = this.workflows.findIndex(
      (workflow) =>
        workflow.companyId === input.tenant.companyId &&
        workflow.id === input.workflowId &&
        input.fromStatuses.includes(workflow.status),
    );
    if (index < 0) return Promise.resolve(null);
    const current = this.workflows[index];
    const updated: ProcessingWorkflowRecord = {
      ...current,
      status: input.toStatus,
      currentStepKey: input.currentStepKey ?? current.currentStepKey,
      failureKind: input.failureKind ?? current.failureKind,
      failureCode: input.failureCode ?? current.failureCode,
      failureMessage: input.failureMessage ?? current.failureMessage,
      startedAt: input.toStatus === "running" ? (current.startedAt ?? input.at) : current.startedAt,
      completedAt: input.toStatus === "completed" ? input.at : current.completedAt,
      failedAt: input.toStatus === "failed" ? input.at : current.failedAt,
      cancelledAt: input.toStatus === "cancelled" ? input.at : current.cancelledAt,
      updatedAt: input.at,
    };
    this.workflows[index] = updated;
    return Promise.resolve(updated);
  }

  public updateStepStatus(input: {
    readonly tenant: TenantContext;
    readonly stepId: ProcessingWorkflowStepId;
    readonly fromStatuses: readonly WorkflowStepStatus[];
    readonly toStatus: WorkflowStepStatus;
    readonly attemptCount?: number;
    readonly nextRunAt?: Date | null;
    readonly failureKind?: WorkflowFailureKind | null;
    readonly failureCode?: string | null;
    readonly failureMessage?: string | null;
    readonly checkpoint?: Record<string, unknown>;
    readonly at: Date;
  }): Promise<ProcessingWorkflowStepRecord | null> {
    const index = this.steps.findIndex(
      (step) =>
        step.companyId === input.tenant.companyId &&
        step.id === input.stepId &&
        input.fromStatuses.includes(step.status),
    );
    if (index < 0) return Promise.resolve(null);
    const current = this.steps[index];
    const updated: ProcessingWorkflowStepRecord = {
      ...current,
      status: input.toStatus,
      attemptCount: input.attemptCount ?? current.attemptCount,
      nextRunAt: input.nextRunAt === undefined ? current.nextRunAt : input.nextRunAt,
      failureKind: input.failureKind === undefined ? current.failureKind : input.failureKind,
      failureCode: input.failureCode === undefined ? current.failureCode : input.failureCode,
      failureMessage:
        input.failureMessage === undefined ? current.failureMessage : input.failureMessage,
      checkpoint: input.checkpoint ?? current.checkpoint,
      startedAt: input.toStatus === "running" ? (current.startedAt ?? input.at) : current.startedAt,
      completedAt: input.toStatus === "succeeded" ? input.at : current.completedAt,
      failedAt: input.toStatus === "failed" ? input.at : current.failedAt,
      cancelledAt: input.toStatus === "cancelled" ? input.at : current.cancelledAt,
      updatedAt: input.at,
    };
    this.steps[index] = updated;
    return Promise.resolve(updated);
  }

  public upsertAttemptStarted(
    input: Parameters<WorkflowRepository["upsertAttemptStarted"]>[0],
  ): Promise<WorkflowStepAttemptRecord> {
    const existingIndex = this.attempts.findIndex(
      (attempt) =>
        attempt.companyId === input.companyId &&
        attempt.stepId === input.stepId &&
        attempt.attemptNumber === input.attemptNumber,
    );
    if (existingIndex >= 0) {
      const current = this.attempts[existingIndex];
      const updated: WorkflowStepAttemptRecord = {
        ...current,
        status: "running",
        failureKind: null,
        errorCode: null,
        errorMessage: null,
        startedAt: input.startedAt,
        completedAt: null,
        checkpoint: input.checkpoint,
        metadata: input.metadata,
      };
      this.attempts[existingIndex] = updated;
      return Promise.resolve(updated);
    }
    const attempt: WorkflowStepAttemptRecord = {
      id: `attempt_${String(this.attempts.length + 1)}`,
      ...input,
      status: "running",
      failureKind: null,
      errorCode: null,
      errorMessage: null,
      completedAt: null,
      createdAt: new Date("2026-06-30T00:00:00.000Z"),
    };
    this.attempts.push(attempt);
    return Promise.resolve(attempt);
  }

  public completeAttempt(
    input: Parameters<WorkflowRepository["completeAttempt"]>[0],
  ): Promise<WorkflowStepAttemptRecord> {
    const existingIndex = this.attempts.findIndex(
      (attempt) =>
        attempt.companyId === input.companyId &&
        attempt.stepId === input.stepId &&
        attempt.attemptNumber === input.attemptNumber,
    );
    if (existingIndex >= 0) {
      const current = this.attempts[existingIndex];
      const updated: WorkflowStepAttemptRecord = {
        ...current,
        status: input.status,
        failureKind: input.failureKind,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        completedAt: input.completedAt,
        checkpoint: input.checkpoint,
        metadata: input.metadata,
      };
      this.attempts[existingIndex] = updated;
      return Promise.resolve(updated);
    }
    const attempt: WorkflowStepAttemptRecord = {
      id: `attempt_${String(this.attempts.length + 1)}`,
      ...input,
      startedAt: input.completedAt,
      createdAt: new Date("2026-06-30T00:00:00.000Z"),
    };
    this.attempts.push(attempt);
    return Promise.resolve(attempt);
  }

  public createDeadLetter(
    input: Parameters<WorkflowRepository["createDeadLetter"]>[0],
  ): Promise<WorkflowDeadLetterJobRecord> {
    const now = new Date("2026-06-30T00:00:00.000Z");
    const record: WorkflowDeadLetterJobRecord = {
      id: `dead_${String(this.deadLetters.length + 1)}` as WorkflowDeadLetterJobId,
      ...input,
      status: "open",
      replayedAt: null,
      cancelledAt: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.deadLetters.push(record);
    return Promise.resolve(record);
  }

  public updateDeadLetterStatus(input: {
    readonly tenant: TenantContext;
    readonly id: WorkflowDeadLetterJobId;
    readonly fromStatuses: readonly WorkflowDeadLetterStatus[];
    readonly toStatus: WorkflowDeadLetterStatus;
    readonly at: Date;
  }): Promise<WorkflowDeadLetterJobRecord | null> {
    const index = this.deadLetters.findIndex(
      (record) =>
        record.companyId === input.tenant.companyId &&
        record.id === input.id &&
        input.fromStatuses.includes(record.status),
    );
    if (index < 0) return Promise.resolve(null);
    const current = this.deadLetters[index];
    const updated: WorkflowDeadLetterJobRecord = {
      ...current,
      status: input.toStatus,
      replayedAt: input.toStatus === "replayed" ? input.at : current.replayedAt,
      cancelledAt: input.toStatus === "cancelled" ? input.at : current.cancelledAt,
      resolvedAt: input.toStatus === "resolved" ? input.at : current.resolvedAt,
      updatedAt: input.at,
    };
    this.deadLetters[index] = updated;
    return Promise.resolve(updated);
  }
}

function createStepRecord(
  input: WorkflowStepDefinition & {
    readonly companyId: TenantId;
    readonly workflowId: ProcessingWorkflowId;
    readonly id: ProcessingWorkflowStepId;
    readonly idempotencyKey: string;
  },
): ProcessingWorkflowStepRecord {
  const now = new Date("2026-06-30T00:00:00.000Z");
  return {
    id: input.id,
    companyId: input.companyId,
    workflowId: input.workflowId,
    stepKey: input.stepKey,
    queueName: input.queueName,
    status: "pending",
    sequence: input.sequence,
    idempotencyKey: input.idempotencyKey,
    dependencyStepKeys: input.dependencyStepKeys ?? [],
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? 3,
    nextRunAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    failureKind: null,
    failureCode: null,
    failureMessage: null,
    checkpoint: {},
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}
