import { env } from "@/config";
import { createManagedWorker, type WorkflowQueuePayload } from "@/infra/queue";
import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import { createTenantContext } from "@/modules/tenant";

import { PrismaWorkflowRepository } from "./prisma-workflow-repository";
import { WorkflowDomainError, WorkflowService } from "./service";

import type { ProcessingWorkflowStepRecord, WorkflowFailureKind } from "./types";
import type { Job } from "bullmq";

export interface WorkflowStepHandlerResult {
  readonly checkpoint?: Record<string, unknown>;
}

export interface WorkflowStepHandler {
  handle(input: {
    readonly step: ProcessingWorkflowStepRecord;
    readonly payload: WorkflowQueuePayload;
  }): Promise<WorkflowStepHandlerResult>;
}

export type WorkflowStepHandlerRegistry = Readonly<Partial<Record<string, WorkflowStepHandler>>>;

export class WorkflowWorkerError extends Error {
  public constructor(
    message: string,
    public readonly failureKind: WorkflowFailureKind,
    public readonly code: string,
  ) {
    super(message);
    this.name = "WorkflowWorkerError";
  }
}

export function createWorkflowOrchestrationWorker(handlers: WorkflowStepHandlerRegistry) {
  const service = new WorkflowService(
    new PrismaWorkflowRepository(),
    new AuditWriter(new PrismaAuditEventStore()),
  );

  return createManagedWorker<WorkflowQueuePayload>(
    {
      queueName: "orchestration",
      concurrency: env.WORKER_ORCHESTRATION_CONCURRENCY,
    },
    async (job) => {
      await processWorkflowJob(service, handlers, job);
    },
  );
}

export async function processWorkflowJob(
  service: WorkflowService,
  handlers: WorkflowStepHandlerRegistry,
  job: Job<WorkflowQueuePayload>,
): Promise<void> {
  const tenant = createTenantContext(job.data.companyId);
  const context = {
    tenant,
    actor: { type: "system" as const, id: null },
    request: {
      requestId: job.data.requestId,
      correlationId: job.data.correlationId,
      sessionId: null,
      ipAddress: null,
      userAgent: "aptly-worker",
    },
  };

  const step = await service.startStep({
    context,
    stepId: job.data.stepId as ProcessingWorkflowStepRecord["id"],
  });
  const handler = handlers[step.stepKey];

  try {
    if (handler === undefined) {
      throw new WorkflowWorkerError(
        "Workflow step handler is not registered.",
        "terminal",
        "WORKFLOW_HANDLER_NOT_REGISTERED",
      );
    }
    const result = await handler.handle({ step, payload: job.data });
    await service.completeStep({
      context,
      stepId: step.id,
      checkpoint: result.checkpoint ?? step.checkpoint,
    });
    await service.queueReadySteps({
      context,
      workflowId: step.workflowId,
    });
  } catch (error) {
    const failure = normalizeWorkerFailure(error);
    await service.failStep({
      context,
      stepId: step.id,
      failureKind: failure.failureKind,
      errorCode: failure.code,
      errorMessage: failure.message,
      retryAfterMs: failure.failureKind === "retryable" ? 30_000 : undefined,
      checkpoint: step.checkpoint,
    });
    if (failure.failureKind === "terminal") {
      await service.recordDeadLetter({
        context,
        queueName: "orchestration",
        jobName: job.name,
        bullJobId: job.id ?? null,
        workflowId: step.workflowId,
        stepId: step.id,
        failureKind: failure.failureKind,
        errorCode: failure.code,
        errorMessage: failure.message,
        payloadSummary: {
          workflowId: job.data.workflowId,
          stepId: job.data.stepId,
          stepKey: job.data.stepKey,
        },
      });
    }
    throw error;
  }
}

function normalizeWorkerFailure(error: unknown): {
  readonly failureKind: WorkflowFailureKind;
  readonly code: string;
  readonly message: string;
} {
  if (error instanceof WorkflowWorkerError) {
    return {
      failureKind: error.failureKind,
      code: error.code,
      message: error.message,
    };
  }
  if (error instanceof WorkflowDomainError) {
    return {
      failureKind: "terminal",
      code: "WORKFLOW_DOMAIN_ERROR",
      message: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      failureKind: "retryable",
      code: "WORKFLOW_HANDLER_ERROR",
      message: error.message,
    };
  }
  return {
    failureKind: "retryable",
    code: "WORKFLOW_HANDLER_UNKNOWN_ERROR",
    message: "Workflow handler failed with an unknown error.",
  };
}
