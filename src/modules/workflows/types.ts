import type { AuditActor, AuditRequestContext } from "@/modules/audit";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type ProcessingWorkflowId = Brand<string, "ProcessingWorkflowId">;
export type ProcessingWorkflowStepId = Brand<string, "ProcessingWorkflowStepId">;
export type WorkflowDeadLetterJobId = Brand<string, "WorkflowDeadLetterJobId">;

export const workflowStatuses = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "partially_completed",
] as const;

export type WorkflowStatus = (typeof workflowStatuses)[number];

export const workflowStepStatuses = [
  "pending",
  "queued",
  "running",
  "succeeded",
  "retry_scheduled",
  "failed",
  "cancelled",
  "skipped",
] as const;

export type WorkflowStepStatus = (typeof workflowStepStatuses)[number];

export type WorkflowFailureKind = "retryable" | "terminal";
export type WorkflowDeadLetterStatus = "open" | "replayed" | "cancelled" | "resolved";

export interface WorkflowMutationContext {
  readonly tenant: TenantContext;
  readonly actor: AuditActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface ProcessingWorkflowRecord {
  readonly id: ProcessingWorkflowId;
  readonly companyId: TenantId;
  readonly workflowType: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly status: WorkflowStatus;
  readonly idempotencyKey: string;
  readonly currentStepKey: string | null;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly failedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly failureKind: WorkflowFailureKind | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly checkpoint: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProcessingWorkflowStepRecord {
  readonly id: ProcessingWorkflowStepId;
  readonly companyId: TenantId;
  readonly workflowId: ProcessingWorkflowId;
  readonly stepKey: string;
  readonly queueName: string;
  readonly status: WorkflowStepStatus;
  readonly sequence: number;
  readonly idempotencyKey: string;
  readonly dependencyStepKeys: readonly string[];
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly nextRunAt: Date | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly failedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly failureKind: WorkflowFailureKind | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly checkpoint: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WorkflowStepAttemptRecord {
  readonly id: string;
  readonly companyId: TenantId;
  readonly workflowId: ProcessingWorkflowId;
  readonly stepId: ProcessingWorkflowStepId;
  readonly attemptNumber: number;
  readonly status: WorkflowStepStatus;
  readonly failureKind: WorkflowFailureKind | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly checkpoint: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface WorkflowDeadLetterJobRecord {
  readonly id: WorkflowDeadLetterJobId;
  readonly companyId: TenantId;
  readonly queueName: string;
  readonly jobName: string;
  readonly bullJobId: string | null;
  readonly workflowId: ProcessingWorkflowId | null;
  readonly stepId: ProcessingWorkflowStepId | null;
  readonly status: WorkflowDeadLetterStatus;
  readonly failureKind: WorkflowFailureKind;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly payloadSummary: Record<string, unknown>;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly replayedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WorkflowStepDefinition {
  readonly stepKey: string;
  readonly queueName: string;
  readonly sequence: number;
  readonly dependencyStepKeys?: readonly string[];
  readonly maxAttempts?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface WorkflowRepository {
  findWorkflowByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<ProcessingWorkflowRecord | null>;

  findWorkflow(
    tenant: TenantContext,
    id: ProcessingWorkflowId,
  ): Promise<ProcessingWorkflowRecord | null>;

  listWorkflows(input: {
    readonly tenant: TenantContext;
    readonly status?: WorkflowStatus;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<readonly ProcessingWorkflowRecord[]>;

  createWorkflow(input: {
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
  }>;

  listSteps(
    tenant: TenantContext,
    workflowId: ProcessingWorkflowId,
  ): Promise<readonly ProcessingWorkflowStepRecord[]>;

  findStep(
    tenant: TenantContext,
    stepId: ProcessingWorkflowStepId,
  ): Promise<ProcessingWorkflowStepRecord | null>;

  updateWorkflowStatus(input: {
    readonly tenant: TenantContext;
    readonly workflowId: ProcessingWorkflowId;
    readonly fromStatuses: readonly WorkflowStatus[];
    readonly toStatus: WorkflowStatus;
    readonly currentStepKey?: string | null;
    readonly failureKind?: WorkflowFailureKind | null;
    readonly failureCode?: string | null;
    readonly failureMessage?: string | null;
    readonly at: Date;
  }): Promise<ProcessingWorkflowRecord | null>;

  updateStepStatus(input: {
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
  }): Promise<ProcessingWorkflowStepRecord | null>;

  upsertAttemptStarted(input: {
    readonly companyId: TenantId;
    readonly workflowId: ProcessingWorkflowId;
    readonly stepId: ProcessingWorkflowStepId;
    readonly attemptNumber: number;
    readonly startedAt: Date;
    readonly checkpoint: Record<string, unknown>;
    readonly metadata: Record<string, unknown>;
  }): Promise<WorkflowStepAttemptRecord>;

  completeAttempt(input: {
    readonly companyId: TenantId;
    readonly workflowId: ProcessingWorkflowId;
    readonly stepId: ProcessingWorkflowStepId;
    readonly attemptNumber: number;
    readonly status: Extract<WorkflowStepStatus, "succeeded" | "failed">;
    readonly failureKind: WorkflowFailureKind | null;
    readonly errorCode: string | null;
    readonly errorMessage: string | null;
    readonly completedAt: Date;
    readonly checkpoint: Record<string, unknown>;
    readonly metadata: Record<string, unknown>;
  }): Promise<WorkflowStepAttemptRecord>;

  createDeadLetter(input: {
    readonly companyId: TenantId;
    readonly queueName: string;
    readonly jobName: string;
    readonly bullJobId: string | null;
    readonly workflowId: ProcessingWorkflowId | null;
    readonly stepId: ProcessingWorkflowStepId | null;
    readonly failureKind: WorkflowFailureKind;
    readonly errorCode: string | null;
    readonly errorMessage: string | null;
    readonly payloadSummary: Record<string, unknown>;
    readonly requestId: string | null;
    readonly correlationId: string | null;
  }): Promise<WorkflowDeadLetterJobRecord>;

  updateDeadLetterStatus(input: {
    readonly tenant: TenantContext;
    readonly id: WorkflowDeadLetterJobId;
    readonly fromStatuses: readonly WorkflowDeadLetterStatus[];
    readonly toStatus: WorkflowDeadLetterStatus;
    readonly at: Date;
  }): Promise<WorkflowDeadLetterJobRecord | null>;
}
