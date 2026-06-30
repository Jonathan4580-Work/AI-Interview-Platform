import { prisma } from "@/infra/database";

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
} from "./types";
import type {
  ProcessingWorkflow,
  ProcessingWorkflowStep,
  Prisma,
  WorkflowDeadLetterJob,
  WorkflowStepAttempt,
} from "@prisma/client";
import type { TenantContext, TenantId } from "@/modules/tenant";

export class PrismaWorkflowRepository implements WorkflowRepository {
  public async findWorkflowByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<ProcessingWorkflowRecord | null> {
    const record = await prisma.processingWorkflow.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: input.companyId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    return record === null ? null : mapWorkflow(record);
  }

  public async findWorkflow(
    tenant: TenantContext,
    id: ProcessingWorkflowId,
  ): Promise<ProcessingWorkflowRecord | null> {
    const record = await prisma.processingWorkflow.findUnique({
      where: { companyId_id: { companyId: tenant.companyId, id } },
    });
    return record === null ? null : mapWorkflow(record);
  }

  public async listWorkflows(input: {
    readonly tenant: TenantContext;
    readonly status?: WorkflowStatus;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<readonly ProcessingWorkflowRecord[]> {
    const records = await prisma.processingWorkflow.findMany({
      where: {
        companyId: input.tenant.companyId,
        ...(input.status === undefined ? {} : { status: toPrismaWorkflowStatus(input.status) }),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      ...(input.cursor === undefined ? {} : { cursor: { id: input.cursor }, skip: 1 }),
    });
    return records.map(mapWorkflow);
  }

  public async createWorkflow(input: {
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
    const created = await prisma.$transaction(async (tx) => {
      const workflow = await tx.processingWorkflow.create({
        data: {
          companyId: input.companyId,
          workflowType: input.workflowType,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          idempotencyKey: input.idempotencyKey,
          requestId: input.requestId,
          correlationId: input.correlationId,
          checkpointJson: {},
          metadataJson: toInputJson(input.metadata),
        },
      });
      await tx.processingWorkflowStep.createMany({
        data: input.steps.map((step) => ({
          companyId: input.companyId,
          workflowId: workflow.id,
          stepKey: step.stepKey,
          queueName: step.queueName,
          sequence: step.sequence,
          idempotencyKey: `${input.idempotencyKey}:${step.stepKey}`,
          dependencyStepKeys: [...(step.dependencyStepKeys ?? [])],
          maxAttempts: step.maxAttempts ?? 3,
          checkpointJson: {},
          metadataJson: toInputJson(step.metadata ?? {}),
        })),
      });
      const steps = await tx.processingWorkflowStep.findMany({
        where: { companyId: input.companyId, workflowId: workflow.id },
        orderBy: { sequence: "asc" },
      });
      return { workflow, steps };
    });
    return {
      workflow: mapWorkflow(created.workflow),
      steps: created.steps.map(mapStep),
    };
  }

  public async listSteps(
    tenant: TenantContext,
    workflowId: ProcessingWorkflowId,
  ): Promise<readonly ProcessingWorkflowStepRecord[]> {
    const records = await prisma.processingWorkflowStep.findMany({
      where: { companyId: tenant.companyId, workflowId },
      orderBy: { sequence: "asc" },
    });
    return records.map(mapStep);
  }

  public async findStep(
    tenant: TenantContext,
    stepId: ProcessingWorkflowStepId,
  ): Promise<ProcessingWorkflowStepRecord | null> {
    const record = await prisma.processingWorkflowStep.findUnique({
      where: { companyId_id: { companyId: tenant.companyId, id: stepId } },
    });
    return record === null ? null : mapStep(record);
  }

  public async updateWorkflowStatus(input: {
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
    const existing = await prisma.processingWorkflow.findFirst({
      where: {
        companyId: input.tenant.companyId,
        id: input.workflowId,
        status: { in: input.fromStatuses.map(toPrismaWorkflowStatus) },
      },
    });
    if (existing === null) {
      return null;
    }
    const updated = await prisma.processingWorkflow.update({
      where: { companyId_id: { companyId: input.tenant.companyId, id: input.workflowId } },
      data: {
        status: toPrismaWorkflowStatus(input.toStatus),
        currentStepKey: input.currentStepKey,
        failureKind: toOptionalPrismaFailureKind(input.failureKind),
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
        startedAt: input.toStatus === "running" ? (existing.startedAt ?? input.at) : undefined,
        completedAt: input.toStatus === "completed" ? input.at : undefined,
        failedAt: input.toStatus === "failed" ? input.at : undefined,
        cancelledAt: input.toStatus === "cancelled" ? input.at : undefined,
      },
    });
    return mapWorkflow(updated);
  }

  public async updateStepStatus(input: {
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
    const existing = await prisma.processingWorkflowStep.findFirst({
      where: {
        companyId: input.tenant.companyId,
        id: input.stepId,
        status: { in: input.fromStatuses.map(toPrismaStepStatus) },
      },
    });
    if (existing === null) {
      return null;
    }
    const updated = await prisma.processingWorkflowStep.update({
      where: { companyId_id: { companyId: input.tenant.companyId, id: input.stepId } },
      data: {
        status: toPrismaStepStatus(input.toStatus),
        attemptCount: input.attemptCount,
        nextRunAt: input.nextRunAt,
        failureKind: toOptionalPrismaFailureKind(input.failureKind),
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
        checkpointJson: input.checkpoint === undefined ? undefined : toInputJson(input.checkpoint),
        startedAt: input.toStatus === "running" ? (existing.startedAt ?? input.at) : undefined,
        completedAt: input.toStatus === "succeeded" ? input.at : undefined,
        failedAt: input.toStatus === "failed" ? input.at : undefined,
        cancelledAt: input.toStatus === "cancelled" ? input.at : undefined,
      },
    });
    return mapStep(updated);
  }

  public async createAttempt(
    input: Parameters<WorkflowRepository["createAttempt"]>[0],
  ): Promise<WorkflowStepAttemptRecord> {
    const record = await prisma.workflowStepAttempt.create({
      data: {
        companyId: input.companyId,
        workflowId: input.workflowId,
        stepId: input.stepId,
        attemptNumber: input.attemptNumber,
        status: toPrismaStepStatus(input.status),
        failureKind: input.failureKind === null ? null : toPrismaFailureKind(input.failureKind),
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        checkpointJson: toInputJson(input.checkpoint),
        metadataJson: toInputJson(input.metadata),
      },
    });
    return mapAttempt(record);
  }

  public async createDeadLetter(
    input: Parameters<WorkflowRepository["createDeadLetter"]>[0],
  ): Promise<WorkflowDeadLetterJobRecord> {
    const record = await prisma.workflowDeadLetterJob.create({
      data: {
        companyId: input.companyId,
        queueName: input.queueName,
        jobName: input.jobName,
        bullJobId: input.bullJobId,
        workflowId: input.workflowId,
        stepId: input.stepId,
        failureKind: toPrismaFailureKind(input.failureKind),
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        payloadSummaryJson: toInputJson(input.payloadSummary),
        requestId: input.requestId,
        correlationId: input.correlationId,
      },
    });
    return mapDeadLetter(record);
  }

  public async updateDeadLetterStatus(input: {
    readonly tenant: TenantContext;
    readonly id: WorkflowDeadLetterJobId;
    readonly fromStatuses: readonly WorkflowDeadLetterStatus[];
    readonly toStatus: WorkflowDeadLetterStatus;
    readonly at: Date;
  }): Promise<WorkflowDeadLetterJobRecord | null> {
    const existing = await prisma.workflowDeadLetterJob.findFirst({
      where: {
        companyId: input.tenant.companyId,
        id: input.id,
        status: { in: input.fromStatuses.map(toPrismaDeadLetterStatus) },
      },
    });
    if (existing === null) {
      return null;
    }
    const updated = await prisma.workflowDeadLetterJob.update({
      where: { companyId_id: { companyId: input.tenant.companyId, id: input.id } },
      data: {
        status: toPrismaDeadLetterStatus(input.toStatus),
        replayedAt: input.toStatus === "replayed" ? input.at : undefined,
        cancelledAt: input.toStatus === "cancelled" ? input.at : undefined,
        resolvedAt: input.toStatus === "resolved" ? input.at : undefined,
      },
    });
    return mapDeadLetter(updated);
  }
}

function mapWorkflow(record: ProcessingWorkflow): ProcessingWorkflowRecord {
  return {
    id: record.id as ProcessingWorkflowId,
    companyId: record.companyId as TenantId,
    workflowType: record.workflowType,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    status: fromPrismaWorkflowStatus(record.status),
    idempotencyKey: record.idempotencyKey,
    currentStepKey: record.currentStepKey,
    requestId: record.requestId,
    correlationId: record.correlationId,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    failedAt: record.failedAt,
    cancelledAt: record.cancelledAt,
    failureKind: fromPrismaFailureKind(record.failureKind),
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    checkpoint: asRecord(record.checkpointJson),
    metadata: asRecord(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapStep(record: ProcessingWorkflowStep): ProcessingWorkflowStepRecord {
  return {
    id: record.id as ProcessingWorkflowStepId,
    companyId: record.companyId as TenantId,
    workflowId: record.workflowId as ProcessingWorkflowId,
    stepKey: record.stepKey,
    queueName: record.queueName,
    status: fromPrismaStepStatus(record.status),
    sequence: record.sequence,
    idempotencyKey: record.idempotencyKey,
    dependencyStepKeys: record.dependencyStepKeys,
    attemptCount: record.attemptCount,
    maxAttempts: record.maxAttempts,
    nextRunAt: record.nextRunAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    failedAt: record.failedAt,
    cancelledAt: record.cancelledAt,
    failureKind: fromPrismaFailureKind(record.failureKind),
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    checkpoint: asRecord(record.checkpointJson),
    metadata: asRecord(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapAttempt(record: WorkflowStepAttempt): WorkflowStepAttemptRecord {
  return {
    id: record.id,
    companyId: record.companyId as TenantId,
    workflowId: record.workflowId as ProcessingWorkflowId,
    stepId: record.stepId as ProcessingWorkflowStepId,
    attemptNumber: record.attemptNumber,
    status: fromPrismaStepStatus(record.status),
    failureKind: fromPrismaFailureKind(record.failureKind),
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    checkpoint: asRecord(record.checkpointJson),
    metadata: asRecord(record.metadataJson),
    createdAt: record.createdAt,
  };
}

function mapDeadLetter(record: WorkflowDeadLetterJob): WorkflowDeadLetterJobRecord {
  return {
    id: record.id as WorkflowDeadLetterJobId,
    companyId: record.companyId as TenantId,
    queueName: record.queueName,
    jobName: record.jobName,
    bullJobId: record.bullJobId,
    workflowId: record.workflowId as ProcessingWorkflowId | null,
    stepId: record.stepId as ProcessingWorkflowStepId | null,
    status: fromPrismaDeadLetterStatus(record.status),
    failureKind: fromPrismaFailureKind(record.failureKind) ?? "terminal",
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    payloadSummary: asRecord(record.payloadSummaryJson),
    requestId: record.requestId,
    correlationId: record.correlationId,
    replayedAt: record.replayedAt,
    cancelledAt: record.cancelledAt,
    resolvedAt: record.resolvedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPrismaWorkflowStatus(status: WorkflowStatus) {
  return status.toUpperCase() as ProcessingWorkflow["status"];
}

function fromPrismaWorkflowStatus(status: ProcessingWorkflow["status"]): WorkflowStatus {
  return status.toLowerCase() as WorkflowStatus;
}

function toPrismaStepStatus(status: WorkflowStepStatus) {
  return status.toUpperCase() as ProcessingWorkflowStep["status"];
}

function fromPrismaStepStatus(status: ProcessingWorkflowStep["status"]): WorkflowStepStatus {
  return status.toLowerCase() as WorkflowStepStatus;
}

function toPrismaFailureKind(kind: WorkflowFailureKind) {
  return kind.toUpperCase() as NonNullable<ProcessingWorkflowStep["failureKind"]>;
}

function fromPrismaFailureKind(
  kind: ProcessingWorkflow["failureKind"],
): WorkflowFailureKind | null {
  return kind === null ? null : (kind.toLowerCase() as WorkflowFailureKind);
}

function toOptionalPrismaFailureKind(kind: WorkflowFailureKind | null | undefined) {
  if (kind === undefined) {
    return undefined;
  }
  return kind === null ? null : toPrismaFailureKind(kind);
}

function toPrismaDeadLetterStatus(status: WorkflowDeadLetterStatus) {
  return status.toUpperCase() as WorkflowDeadLetterJob["status"];
}

function fromPrismaDeadLetterStatus(
  status: WorkflowDeadLetterJob["status"],
): WorkflowDeadLetterStatus {
  return status.toLowerCase() as WorkflowDeadLetterStatus;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}
