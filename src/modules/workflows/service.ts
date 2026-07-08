import { AuditWriter } from "@/modules/audit";

import type {
  ProcessingWorkflowId,
  ProcessingWorkflowRecord,
  ProcessingWorkflowStepId,
  ProcessingWorkflowStepRecord,
  WorkflowDeadLetterJobId,
  WorkflowFailureKind,
  WorkflowMutationContext,
  WorkflowRepository,
  WorkflowStepDefinition,
  WorkflowStepStatus,
} from "./types";

export class WorkflowDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WorkflowDomainError";
  }
}

export class WorkflowService {
  public constructor(
    private readonly repository: WorkflowRepository,
    private readonly auditWriter: AuditWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async createWorkflow(input: {
    readonly context: WorkflowMutationContext;
    readonly workflowType: string;
    readonly subjectType: string;
    readonly subjectId: string;
    readonly idempotencyKey: string;
    readonly steps: readonly WorkflowStepDefinition[];
    readonly metadata?: Record<string, unknown>;
  }): Promise<ProcessingWorkflowRecord> {
    const idempotencyKey = normalizeKey(input.idempotencyKey, "Workflow idempotency key");
    const existing = await this.repository.findWorkflowByIdempotency({
      companyId: input.context.tenant.companyId,
      idempotencyKey,
    });
    if (existing !== null) {
      return existing;
    }

    validateStepDefinitions(input.steps);
    const created = await this.repository.createWorkflow({
      companyId: input.context.tenant.companyId,
      workflowType: normalizeKey(input.workflowType, "Workflow type"),
      subjectType: normalizeKey(input.subjectType, "Subject type"),
      subjectId: normalizeKey(input.subjectId, "Subject ID"),
      idempotencyKey,
      requestId: input.context.request.requestId,
      correlationId: input.context.request.correlationId,
      metadata: safeJson(input.metadata ?? {}),
      steps: input.steps.map((step) => ({
        ...step,
        stepKey: normalizeKey(step.stepKey, "Step key"),
        queueName: normalizeKey(step.queueName, "Queue name"),
        dependencyStepKeys: step.dependencyStepKeys ?? [],
        maxAttempts: normalizeAttempts(step.maxAttempts ?? 3),
        metadata: safeJson(step.metadata ?? {}),
      })),
    });

    await this.writeAudit(
      input.context,
      "workflow.created",
      "processing_workflow",
      created.workflow.id,
      {
        after: safeWorkflowAudit(created.workflow, created.steps),
      },
    );
    return created.workflow;
  }

  public async queueReadySteps(input: {
    readonly context: WorkflowMutationContext;
    readonly workflowId: ProcessingWorkflowId;
  }): Promise<readonly ProcessingWorkflowStepRecord[]> {
    const workflow = await this.requireWorkflow(input.context, input.workflowId);
    if (workflow.status === "cancelled" || workflow.status === "failed") {
      return [];
    }

    const steps = await this.repository.listSteps(input.context.tenant, workflow.id);
    const readySteps = steps.filter((step) => isStepReady(step, steps));
    const queued: ProcessingWorkflowStepRecord[] = [];
    for (const step of readySteps) {
      const updated = await this.repository.updateStepStatus({
        tenant: input.context.tenant,
        stepId: step.id,
        fromStatuses: ["pending", "retry_scheduled"],
        toStatus: "queued",
        at: this.now(),
      });
      if (updated !== null) {
        queued.push(updated);
      }
    }

    if (queued.length > 0 && workflow.status === "pending") {
      await this.repository.updateWorkflowStatus({
        tenant: input.context.tenant,
        workflowId: workflow.id,
        fromStatuses: ["pending"],
        toStatus: "running",
        currentStepKey: queued[0]?.stepKey ?? null,
        at: this.now(),
      });
    }
    return queued;
  }

  public async startStep(input: {
    readonly context: WorkflowMutationContext;
    readonly stepId: ProcessingWorkflowStepId;
  }): Promise<ProcessingWorkflowStepRecord> {
    const step = await this.requireStep(input.context, input.stepId);
    const updated = await this.repository.updateStepStatus({
      tenant: input.context.tenant,
      stepId: step.id,
      fromStatuses: ["queued", "retry_scheduled"],
      toStatus: "running",
      attemptCount: step.attemptCount + 1,
      at: this.now(),
    });
    if (updated === null) {
      throw new WorkflowDomainError("Workflow step cannot start from its current status.");
    }
    await this.repository.upsertAttemptStarted({
      companyId: input.context.tenant.companyId,
      workflowId: updated.workflowId,
      stepId: updated.id,
      attemptNumber: updated.attemptCount,
      startedAt: updated.startedAt ?? this.now(),
      checkpoint: updated.checkpoint,
      metadata: {},
    });
    return updated;
  }

  public async completeStep(input: {
    readonly context: WorkflowMutationContext;
    readonly stepId: ProcessingWorkflowStepId;
    readonly checkpoint?: Record<string, unknown>;
  }): Promise<ProcessingWorkflowStepRecord> {
    const step = await this.requireStep(input.context, input.stepId);
    if (step.status === "succeeded") {
      await this.closeSucceededAttempt(input.context, step);
      await this.finalizeWorkflowIfComplete(input.context, step.workflowId);
      return step;
    }
    const completed = await this.repository.updateStepStatus({
      tenant: input.context.tenant,
      stepId: step.id,
      fromStatuses: ["running"],
      toStatus: "succeeded",
      checkpoint: safeJson(input.checkpoint ?? step.checkpoint),
      at: this.now(),
    });
    if (completed === null) {
      throw new WorkflowDomainError("Workflow step cannot complete from its current status.");
    }

    await this.repository.completeAttempt({
      companyId: input.context.tenant.companyId,
      workflowId: completed.workflowId,
      stepId: completed.id,
      attemptNumber: completed.attemptCount,
      status: "succeeded",
      failureKind: null,
      errorCode: null,
      errorMessage: null,
      completedAt: completed.completedAt ?? this.now(),
      checkpoint: completed.checkpoint,
      metadata: {},
    });
    await this.finalizeWorkflowIfComplete(input.context, completed.workflowId);
    return completed;
  }

  public async failStep(input: {
    readonly context: WorkflowMutationContext;
    readonly stepId: ProcessingWorkflowStepId;
    readonly failureKind: WorkflowFailureKind;
    readonly errorCode: string;
    readonly errorMessage: string;
    readonly retryAfterMs?: number;
    readonly checkpoint?: Record<string, unknown>;
  }): Promise<ProcessingWorkflowStepRecord> {
    const step = await this.requireStep(input.context, input.stepId);
    if (step.status === "succeeded") {
      await this.closeSucceededAttempt(input.context, step);
      await this.finalizeWorkflowIfComplete(input.context, step.workflowId);
      return step;
    }
    const retryable = input.failureKind === "retryable" && step.attemptCount < step.maxAttempts;
    const status: WorkflowStepStatus = retryable ? "retry_scheduled" : "failed";
    const failed = await this.repository.updateStepStatus({
      tenant: input.context.tenant,
      stepId: step.id,
      fromStatuses: ["running", "queued", "retry_scheduled"],
      toStatus: status,
      nextRunAt: retryable ? new Date(this.now().getTime() + (input.retryAfterMs ?? 30_000)) : null,
      failureKind: input.failureKind,
      failureCode: normalizeProviderText(input.errorCode),
      failureMessage: normalizeProviderText(input.errorMessage),
      checkpoint: safeJson(input.checkpoint ?? step.checkpoint),
      at: this.now(),
    });
    if (failed === null) {
      throw new WorkflowDomainError("Workflow step cannot fail from its current status.");
    }

    await this.repository.completeAttempt({
      companyId: input.context.tenant.companyId,
      workflowId: failed.workflowId,
      stepId: failed.id,
      attemptNumber: Math.max(failed.attemptCount, 1),
      status: "failed",
      failureKind: input.failureKind,
      errorCode: normalizeProviderText(input.errorCode),
      errorMessage: normalizeProviderText(input.errorMessage),
      completedAt: this.now(),
      checkpoint: failed.checkpoint,
      metadata: {},
    });

    if (!retryable) {
      await this.repository.updateWorkflowStatus({
        tenant: input.context.tenant,
        workflowId: failed.workflowId,
        fromStatuses: ["pending", "running", "partially_completed"],
        toStatus: "failed",
        currentStepKey: failed.stepKey,
        failureKind: input.failureKind,
        failureCode: normalizeProviderText(input.errorCode),
        failureMessage: normalizeProviderText(input.errorMessage),
        at: this.now(),
      });
    }
    return failed;
  }

  public async cancelWorkflow(input: {
    readonly context: WorkflowMutationContext;
    readonly workflowId: ProcessingWorkflowId;
    readonly reason: string;
  }): Promise<ProcessingWorkflowRecord> {
    const workflow = await this.requireWorkflow(input.context, input.workflowId);
    const cancelled = await this.repository.updateWorkflowStatus({
      tenant: input.context.tenant,
      workflowId: workflow.id,
      fromStatuses: ["pending", "running", "failed", "partially_completed"],
      toStatus: "cancelled",
      failureMessage: normalizeProviderText(input.reason),
      at: this.now(),
    });
    if (cancelled === null) {
      throw new WorkflowDomainError("Workflow cannot be cancelled from its current status.");
    }
    await this.writeAudit(input.context, "workflow.cancelled", "processing_workflow", workflow.id, {
      before: safeWorkflowAudit(workflow),
      after: safeWorkflowAudit(cancelled),
    });
    return cancelled;
  }

  public async replayStep(input: {
    readonly context: WorkflowMutationContext;
    readonly stepId: ProcessingWorkflowStepId;
    readonly reason: string;
  }): Promise<ProcessingWorkflowStepRecord> {
    const step = await this.requireStep(input.context, input.stepId);
    if (step.status !== "failed" && step.status !== "retry_scheduled") {
      throw new WorkflowDomainError("Only failed or retry-scheduled steps can be replayed.");
    }
    const replayed = await this.repository.updateStepStatus({
      tenant: input.context.tenant,
      stepId: step.id,
      fromStatuses: ["failed", "retry_scheduled"],
      toStatus: "pending",
      nextRunAt: null,
      failureKind: null,
      failureCode: null,
      failureMessage: null,
      at: this.now(),
    });
    if (replayed === null) {
      throw new WorkflowDomainError("Workflow step could not be replayed.");
    }
    await this.repository.updateWorkflowStatus({
      tenant: input.context.tenant,
      workflowId: replayed.workflowId,
      fromStatuses: ["failed", "partially_completed"],
      toStatus: "running",
      currentStepKey: replayed.stepKey,
      at: this.now(),
    });
    await this.writeAudit(
      input.context,
      "workflow.step_replayed",
      "processing_workflow_step",
      step.id,
      {
        before: safeStepAudit(step),
        after: { ...safeStepAudit(replayed), reason: normalizeProviderText(input.reason) },
      },
    );
    return replayed;
  }

  public async recordDeadLetter(input: {
    readonly context: WorkflowMutationContext;
    readonly queueName: string;
    readonly jobName: string;
    readonly bullJobId?: string | null;
    readonly workflowId?: ProcessingWorkflowId | null;
    readonly stepId?: ProcessingWorkflowStepId | null;
    readonly failureKind: WorkflowFailureKind;
    readonly errorCode?: string | null;
    readonly errorMessage?: string | null;
    readonly payloadSummary: Record<string, unknown>;
  }) {
    const record = await this.repository.createDeadLetter({
      companyId: input.context.tenant.companyId,
      queueName: normalizeKey(input.queueName, "Queue name"),
      jobName: normalizeKey(input.jobName, "Job name"),
      bullJobId: input.bullJobId ?? null,
      workflowId: input.workflowId ?? null,
      stepId: input.stepId ?? null,
      failureKind: input.failureKind,
      errorCode: normalizeOptionalProviderText(input.errorCode ?? null),
      errorMessage: normalizeOptionalProviderText(input.errorMessage ?? null),
      payloadSummary: safeJson(input.payloadSummary),
      requestId: input.context.request.requestId,
      correlationId: input.context.request.correlationId,
    });
    await this.writeAudit(
      input.context,
      "workflow.dead_letter_recorded",
      "workflow_dead_letter_job",
      record.id,
      {
        after: record,
      },
    );
    return record;
  }

  public async markDeadLetterReplayed(input: {
    readonly context: WorkflowMutationContext;
    readonly deadLetterId: WorkflowDeadLetterJobId;
    readonly reason: string;
  }) {
    const updated = await this.repository.updateDeadLetterStatus({
      tenant: input.context.tenant,
      id: input.deadLetterId,
      fromStatuses: ["open"],
      toStatus: "replayed",
      at: this.now(),
    });
    if (updated === null) {
      throw new WorkflowDomainError("Dead-letter job cannot be replayed from its current status.");
    }
    await this.writeAudit(
      input.context,
      "workflow.dead_letter_replayed",
      "workflow_dead_letter_job",
      updated.id,
      {
        after: {
          id: updated.id,
          status: updated.status,
          reason: normalizeProviderText(input.reason),
        },
      },
    );
    return updated;
  }

  private async requireWorkflow(
    context: WorkflowMutationContext,
    workflowId: ProcessingWorkflowId,
  ): Promise<ProcessingWorkflowRecord> {
    const workflow = await this.repository.findWorkflow(context.tenant, workflowId);
    if (workflow === null) {
      throw new WorkflowDomainError("Workflow was not found for this company.");
    }
    return workflow;
  }

  private async requireStep(
    context: WorkflowMutationContext,
    stepId: ProcessingWorkflowStepId,
  ): Promise<ProcessingWorkflowStepRecord> {
    const step = await this.repository.findStep(context.tenant, stepId);
    if (step === null) {
      throw new WorkflowDomainError("Workflow step was not found for this company.");
    }
    return step;
  }

  private async finalizeWorkflowIfComplete(
    context: WorkflowMutationContext,
    workflowId: ProcessingWorkflowId,
  ): Promise<void> {
    const steps = await this.repository.listSteps(context.tenant, workflowId);
    if (!steps.every((step) => step.status === "succeeded" || step.status === "skipped")) {
      return;
    }
    await this.repository.updateWorkflowStatus({
      tenant: context.tenant,
      workflowId,
      fromStatuses: ["pending", "running", "partially_completed"],
      toStatus: "completed",
      currentStepKey: null,
      at: this.now(),
    });
  }

  private async closeSucceededAttempt(
    context: WorkflowMutationContext,
    step: ProcessingWorkflowStepRecord,
  ): Promise<void> {
    await this.repository.completeAttempt({
      companyId: context.tenant.companyId,
      workflowId: step.workflowId,
      stepId: step.id,
      attemptNumber: Math.max(step.attemptCount, 1),
      status: "succeeded",
      failureKind: null,
      errorCode: null,
      errorMessage: null,
      completedAt: step.completedAt ?? this.now(),
      checkpoint: step.checkpoint,
      metadata: {},
    });
  }

  private async writeAudit(
    context: WorkflowMutationContext,
    action: string,
    resourceType: string,
    resourceId: string,
    snapshots: { readonly before?: unknown; readonly after?: unknown },
  ): Promise<void> {
    await this.auditWriter.record({
      companyId: context.tenant.companyId,
      actor: context.actor,
      request: context.request,
      supportAccessSessionId: context.supportAccessSessionId ?? null,
      action,
      resourceType,
      resourceId,
      riskLevel: "medium",
      before: snapshots.before,
      after: snapshots.after,
    });
  }
}

function validateStepDefinitions(steps: readonly WorkflowStepDefinition[]): void {
  if (steps.length === 0) {
    throw new WorkflowDomainError("A workflow requires at least one step.");
  }
  const keys = new Set<string>();
  const sequenceByKey = new Map<string, number>();
  for (const step of steps) {
    const stepKey = normalizeKey(step.stepKey, "Step key");
    if (keys.has(stepKey)) {
      throw new WorkflowDomainError("Workflow step keys must be unique.");
    }
    keys.add(stepKey);
    sequenceByKey.set(stepKey, step.sequence);
    if (!Number.isInteger(step.sequence) || step.sequence < 1) {
      throw new WorkflowDomainError("Workflow step sequence must be a positive integer.");
    }
    normalizeAttempts(step.maxAttempts ?? 3);
  }
  for (const step of steps) {
    for (const dependency of step.dependencyStepKeys ?? []) {
      if (!keys.has(dependency)) {
        throw new WorkflowDomainError("Workflow step dependency is not defined.");
      }
      if ((sequenceByKey.get(dependency) ?? 0) >= step.sequence) {
        throw new WorkflowDomainError(
          "Workflow step dependencies must run before dependent steps.",
        );
      }
    }
  }
}

function isStepReady(
  step: ProcessingWorkflowStepRecord,
  allSteps: readonly ProcessingWorkflowStepRecord[],
): boolean {
  if (step.status !== "pending" && step.status !== "retry_scheduled") {
    return false;
  }
  const statusByKey = new Map(allSteps.map((candidate) => [candidate.stepKey, candidate.status]));
  return step.dependencyStepKeys.every((dependency) => statusByKey.get(dependency) === "succeeded");
}

function normalizeKey(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9_.:-]{1,160}$/u.test(normalized)) {
    throw new WorkflowDomainError(`${label} must be a stable identifier.`);
  }
  return normalized;
}

function normalizeAttempts(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new WorkflowDomainError("Workflow step max attempts must be between 1 and 20.");
  }
  return value;
}

function normalizeProviderText(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > 500) {
    throw new WorkflowDomainError("Workflow reason or error text must be specific.");
  }
  return normalized;
}

function normalizeOptionalProviderText(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  return normalizeProviderText(value);
}

function safeJson(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function safeWorkflowAudit(
  workflow: ProcessingWorkflowRecord,
  steps: readonly ProcessingWorkflowStepRecord[] = [],
): Record<string, unknown> {
  return {
    id: workflow.id,
    companyId: workflow.companyId,
    workflowType: workflow.workflowType,
    subjectType: workflow.subjectType,
    subjectId: workflow.subjectId,
    status: workflow.status,
    currentStepKey: workflow.currentStepKey,
    stepKeys: steps.map((step) => step.stepKey),
  };
}

function safeStepAudit(step: ProcessingWorkflowStepRecord): Record<string, unknown> {
  return {
    id: step.id,
    workflowId: step.workflowId,
    stepKey: step.stepKey,
    status: step.status,
    attemptCount: step.attemptCount,
    failureKind: step.failureKind,
    failureCode: step.failureCode,
  };
}
