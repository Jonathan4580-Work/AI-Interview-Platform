import { randomUUID } from "node:crypto";

import { Prisma, type LocalJob } from "@prisma/client";

import { env } from "@/config";
import { prisma } from "@/infra/database";
import type { WorkflowQueuePayload } from "@/infra/queue";
import { logger } from "@/infra/logging";
import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import { createPhase9WorkflowHandlers } from "@/modules/evaluation/workflow-handlers";
import { DefaultEmailProviderFactory } from "@/modules/email/provider-factory";
import { PrismaEmailRepository } from "@/modules/email/prisma-email-repository";
import { EmailService, type EmailDeliveryJob } from "@/modules/email/service";
import type { EmailDeliveryId } from "@/modules/email/types";
import { createTenantContext } from "@/modules/tenant";
import { PrismaWorkflowRepository } from "@/modules/workflows/prisma-workflow-repository";
import { WorkflowService } from "@/modules/workflows";
import type { ProcessingWorkflowId } from "@/modules/workflows";
import { processWorkflowJob } from "@/modules/workflows/worker";
import { LocalQueueAdapter } from "@/infra/queue/local-queue";

const pollMs = Number.parseInt(process.env.LOCAL_WORKER_POLL_MS ?? "1000", 10);
const staleAfterMs = Number.parseInt(process.env.LOCAL_WORKER_STALE_AFTER_MS ?? "60000", 10);
let shutdownRequested = false;

const auditWriter = new AuditWriter(new PrismaAuditEventStore());
const emailService = new EmailService(
  new PrismaEmailRepository(),
  new DefaultEmailProviderFactory(),
  new LocalQueueAdapter("email") as never,
  auditWriter,
);
const workflowService = new WorkflowService(new PrismaWorkflowRepository(), auditWriter);
const workflowHandlers = createPhase9WorkflowHandlers();

process.on("SIGINT", requestShutdown);
process.on("SIGTERM", requestShutdown);

logger.info(
  {
    appEnv: env.APP_ENV,
    pollMs,
    staleAfterMs,
    workerClasses: [
      "email",
      "orchestration",
      "media",
      "transcription",
      "evaluation",
      "cv-text-extraction",
      "cv-screening",
      "reporting",
      "notifications",
    ],
  },
  "Local MySQL worker started.",
);

await runLoop();

async function runLoop(): Promise<void> {
  while (!shutdownRequested) {
    await recoverStaleJobs();
    const notificationProcessed = await dispatchPendingNotificationIntent();
    await queuePendingWorkflowSteps();
    const localJobProcessed = await processNextLocalJob();
    const workflowStepProcessed = await processNextWorkflowStep();
    if (!notificationProcessed && !localJobProcessed && !workflowStepProcessed) {
      await sleep(pollMs);
    }
  }

  logger.info("Local MySQL worker stopped.");
  await prisma.$disconnect();
}

async function dispatchPendingNotificationIntent(): Promise<boolean> {
  const intent = await prisma.notificationIntent.findFirst({
    where: {
      status: "PENDING",
      type: "APPLICATION_DECISION",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
  });
  if (intent === null) {
    return false;
  }

  logger.info(
    {
      notificationIntentId: intent.id,
      type: intent.type,
      targetResourceId: intent.targetResourceId,
    },
    "Local notification intent claimed.",
  );

  try {
    const payload = readApplicationDecisionPayload(intent.payloadJson);
    const delivery = await emailService.createDelivery({
      context: {
        tenant: createTenantContext(intent.companyId),
        actor: { type: "system", id: null },
        request: {
          requestId: `notification-${intent.id}`,
          correlationId: `notification-${intent.id}`,
          sessionId: null,
          ipAddress: null,
          userAgent: "aptly-local-worker",
        },
      },
      templateKey: "application_decision",
      templateVariables: {
        companyName: await companyName(intent.companyId),
        recipientName: intent.recipientName ?? "Candidate",
        supportEmail: env.SMTP_REPLY_TO_EMAIL ?? env.SMTP_FROM_EMAIL ?? "support@aptly.local",
        actionUrl: env.CANDIDATE_APP_URL ?? env.APP_URL,
        expirationDate: "Not applicable",
        jobTitle: payload.jobTitle,
        decisionLabel:
          payload.status === "HIRED"
            ? "Application outcome: hired"
            : "Application outcome: not selected",
        decisionMessage:
          payload.status === "HIRED"
            ? "Congratulations. The hiring team has marked your application as hired."
            : "Thank you for your time. The hiring team has completed its review and will not move forward for this role.",
        nextStep:
          payload.status === "HIRED" && payload.onboardingDate !== null
            ? `Target onboarding date: ${payload.onboardingDate}. The hiring team will contact you with next steps.`
            : "You can view the latest status in your Aptly candidate dashboard.",
      },
      recipientEmail: intent.recipientEmail,
      recipientName: intent.recipientName,
      notificationIntentId: intent.id,
      provider: env.EMAIL_DELIVERY_MODE === "preview" ? "preview" : "smtp",
      idempotencyKey: `notification:${intent.id}:application_decision`,
    });
    await emailService.enqueueDelivery({
      context: {
        tenant: createTenantContext(intent.companyId),
        actor: { type: "system", id: null },
        request: {
          requestId: `notification-${intent.id}`,
          correlationId: `notification-${intent.id}`,
          sessionId: null,
          ipAddress: null,
          userAgent: "aptly-local-worker",
        },
      },
      deliveryId: delivery.id,
    });
    await prisma.notificationIntent.update({
      where: { companyId_id: { companyId: intent.companyId, id: intent.id } },
      data: { status: "DISPATCHED", dispatchedAt: new Date(), failureReason: null },
    });
    logger.info(
      { notificationIntentId: intent.id, deliveryId: delivery.id },
      "Local notification intent dispatched to email.",
    );
  } catch (error) {
    await prisma.notificationIntent.update({
      where: { companyId_id: { companyId: intent.companyId, id: intent.id } },
      data: {
        status: "FAILED",
        failureReason: redactError(
          error instanceof Error ? error.message : "Unknown notification failure.",
        ),
      },
    });
    logger.error(
      {
        notificationIntentId: intent.id,
        errorCode: "LOCAL_NOTIFICATION_FAILED",
        message: redactError(
          error instanceof Error ? error.message : "Unknown notification failure.",
        ),
      },
      "Local notification intent failed.",
    );
  }
  return true;
}

async function queuePendingWorkflowSteps(): Promise<void> {
  const workflows = await prisma.processingWorkflow.findMany({
    where: { status: { in: ["PENDING", "RUNNING", "PARTIALLY_COMPLETED"] } },
    select: { id: true, companyId: true, requestId: true, correlationId: true },
    orderBy: { createdAt: "asc" },
    take: 25,
  });
  for (const workflow of workflows) {
    const queued = await workflowService.queueReadySteps({
      context: {
        tenant: createTenantContext(workflow.companyId),
        actor: { type: "system", id: null },
        request: {
          requestId: workflow.requestId ?? `local-workflow-${workflow.id}`,
          correlationId: workflow.correlationId ?? `local-workflow-${workflow.id}`,
          sessionId: null,
          ipAddress: null,
          userAgent: "aptly-local-worker",
        },
      },
      workflowId: workflow.id as ProcessingWorkflowId,
    });
    if (queued.length > 0) {
      logger.info(
        {
          workflowId: workflow.id,
          stepKeys: queued.map((step) => step.stepKey),
        },
        "Local workflow steps queued.",
      );
    }
  }
}

function requestShutdown(): void {
  shutdownRequested = true;
}

async function processNextLocalJob(): Promise<boolean> {
  const claimed = await claimNextLocalJob();
  if (claimed === null) {
    return false;
  }

  logger.info(
    { jobId: claimed.id, type: claimed.type, attempt: claimed.attempts },
    "Local queue job claimed.",
  );

  try {
    await dispatchLocalJob(claimed);
    await prisma.localJob.update({
      where: { id: claimed.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        lockedAt: null,
        lockToken: null,
        lastErrorCode: null,
        lastErrorMessageSafe: null,
      },
    });
    logger.info({ jobId: claimed.id, type: claimed.type }, "Local queue job completed.");
  } catch (error) {
    await failLocalJob(claimed, error);
  }
  return true;
}

async function processNextWorkflowStep(): Promise<boolean> {
  const step = await prisma.processingWorkflowStep.findFirst({
    where: {
      status: { in: ["QUEUED", "RETRY_SCHEDULED"] },
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
    },
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
    include: { workflow: true },
  });
  if (step === null) {
    return false;
  }

  const payload: WorkflowQueuePayload = {
    companyId: step.companyId,
    workflowId: step.workflowId,
    stepId: step.id,
    stepKey: step.stepKey,
    requestId: step.workflow.requestId ?? `local-workflow-${step.workflowId}`,
    correlationId: step.workflow.correlationId ?? `local-workflow-${step.workflowId}`,
  };

  logger.info(
    {
      stepId: step.id,
      workflowId: step.workflowId,
      stepKey: step.stepKey,
      queueName: step.queueName,
      attempt: step.attemptCount + 1,
    },
    "Local workflow step claimed.",
  );

  try {
    await processWorkflowJob(workflowService, workflowHandlers, {
      id: `local:${step.id}`,
      name: step.stepKey,
      data: payload,
    } as never);
    logger.info(
      { stepId: step.id, workflowId: step.workflowId, stepKey: step.stepKey },
      "Local workflow step completed.",
    );
    return true;
  } catch (error) {
    logger.error(
      {
        stepId: step.id,
        workflowId: step.workflowId,
        stepKey: step.stepKey,
        errorCode: "LOCAL_WORKFLOW_STEP_FAILED",
        message: redactError(error instanceof Error ? error.message : "Unknown workflow failure."),
      },
      "Local workflow step failed.",
    );
    return true;
  }
}

async function dispatchLocalJob(job: LocalJob): Promise<void> {
  if (job.type !== "email:send") {
    throw new Error(`Unsupported local job type: ${job.type}`);
  }
  const payload = readEmailDeliveryPayload(job.payloadJson);
  await emailService.processQueuedDelivery({
    tenant: createTenantContext(payload.companyId),
    deliveryId: payload.deliveryId as EmailDeliveryId,
  });
}

async function claimNextLocalJob(): Promise<LocalJob | null> {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.localJob.findFirst({
      where: {
        status: { in: ["QUEUED", "RETRYING"] },
        availableAt: { lte: new Date() },
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    });
    if (candidate === null) {
      return null;
    }

    const lockToken = randomUUID();
    const updated = await tx.localJob.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        lockedAt: candidate.lockedAt,
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        lockedAt: new Date(),
        lockToken,
      },
    });
    if (updated.count !== 1) {
      return null;
    }
    return tx.localJob.findUniqueOrThrow({ where: { id: candidate.id } });
  });
}

async function recoverStaleJobs(): Promise<void> {
  const staleBefore = new Date(Date.now() - staleAfterMs);
  await prisma.localJob.updateMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: staleBefore },
    },
    data: {
      status: "RETRYING",
      availableAt: new Date(Date.now() + pollMs),
      lockedAt: null,
      lockToken: null,
      lastErrorCode: "LOCAL_WORKER_STALE_LOCK",
      lastErrorMessageSafe: "Worker lock expired before completion.",
    },
  });
}

async function failLocalJob(job: LocalJob, error: unknown): Promise<void> {
  const retry = job.attempts < job.maxAttempts;
  const message = error instanceof Error ? error.message : "Unknown local worker failure.";
  await prisma.localJob.update({
    where: { id: job.id },
    data: {
      status: retry ? "RETRYING" : "FAILED",
      availableAt: retry
        ? new Date(Date.now() + Math.min(60_000, 2 ** Math.max(job.attempts, 1) * 1_000))
        : job.availableAt,
      failedAt: retry ? null : new Date(),
      lockedAt: null,
      lockToken: null,
      lastErrorCode: "LOCAL_WORKER_JOB_FAILED",
      lastErrorMessageSafe: redactError(message),
    },
  });
  logger.error(
    {
      jobId: job.id,
      type: job.type,
      retry,
      errorCode: "LOCAL_WORKER_JOB_FAILED",
    },
    "Local queue job failed.",
  );
}

function readEmailDeliveryPayload(value: Prisma.JsonValue): EmailDeliveryJob {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Local job payload must be an object.");
  }
  return value as unknown as EmailDeliveryJob;
}

function readApplicationDecisionPayload(value: Prisma.JsonValue): {
  readonly jobTitle: string;
  readonly status: "HIRED" | "REJECTED";
  readonly onboardingDate: string | null;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Notification payload must be an object.");
  }
  const payload = value as Record<string, unknown>;
  const jobTitle = typeof payload.jobTitle === "string" ? payload.jobTitle.trim() : "";
  const status = payload.status;
  if (jobTitle.length === 0 || (status !== "HIRED" && status !== "REJECTED")) {
    throw new Error("Application decision notification payload is invalid.");
  }
  return {
    jobTitle,
    status,
    onboardingDate:
      typeof payload.onboardingDate === "string" && payload.onboardingDate.length > 0
        ? payload.onboardingDate
        : null,
  };
}

async function companyName(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  return company?.name ?? "the hiring team";
}

function redactError(message: string): string {
  return message.replace(/secret|password|token|apikey|api key/giu, "[redacted]").slice(0, 500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
