import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import { PrismaAiGovernanceRepository } from "@/modules/ai-governance";
import { prisma } from "@/infra/database";
import { createTenantContext } from "@/modules/tenant";
import {
  PrismaTranscriptRepository,
  TranscriptionService,
  createTranscriptionProvider,
} from "@/modules/transcription";
import {
  type WorkflowStepHandler,
  type WorkflowStepHandlerRegistry,
  WorkflowWorkerError,
} from "@/modules/workflows/worker";
import { PrismaReportingRepository, ReportingService } from "@/modules/reporting";
import { processJobDescriptionAnalysis } from "@/modules/jobs/jd-analysis-processing";

import { createEvaluationProvider } from "./providers";
import { PrismaEvaluationRepository } from "./prisma-evaluation-repository";
import { EvaluationProviderError } from "./providers";
import { EvaluationService } from "./service";
import type { InterviewSessionId } from "@/modules/invitations";
import type { WorkflowQueuePayload } from "@/infra/queue";
import type { ProcessingWorkflowStepRecord } from "@/modules/workflows";

export function createPhase9WorkflowHandlers(): WorkflowStepHandlerRegistry {
  const auditWriter = new AuditWriter(new PrismaAuditEventStore());
  const transcriptionService = new TranscriptionService(
    new PrismaTranscriptRepository(),
    createTranscriptionProvider(),
    auditWriter,
  );
  const evaluationService = new EvaluationService(
    new PrismaEvaluationRepository(),
    new PrismaAiGovernanceRepository(),
    createEvaluationProvider(),
    auditWriter,
  );
  const reportingService = new ReportingService(new PrismaReportingRepository(), auditWriter);

  return {
    finalize_media: createHandler(async (input) => {
      const context = buildContext(input.step, input.payload);
      const interviewSessionId = input.step.workflowSubjectId as InterviewSessionId;
      const manifest = await transcriptionService.finalizeMediaManifest({
        context,
        interviewSessionId,
      });
      return { mediaObjectCount: manifest.items.length };
    }),
    jd_ai_analysis: createHandler(async (input) => {
      const context = buildContext(input.step, input.payload);
      const jobId = input.step.workflowSubjectId;
      const result = await processJobDescriptionAnalysis({
        companyId: context.tenant.companyId,
        jobId,
      });
      return { jobId, questionCount: result.questionCount, title: result.title };
    }),
    transcribe_recording: createHandler(async (input) => {
      const context = buildContext(input.step, input.payload);
      const result = await transcriptionService.transcribeInterview({
        context,
        interviewSessionId: input.step.workflowSubjectId as InterviewSessionId,
      });
      return {
        transcriptId: result.transcript.id,
        transcriptVersionId: result.version.id,
      };
    }),
    evaluate_interview: createHandler(async (input) => {
      const context = buildContext(input.step, input.payload);
      try {
        const result = await evaluationService.evaluateInterview({
          context,
          interviewSessionId: input.step.workflowSubjectId as InterviewSessionId,
        });
        return { evaluationVersionId: result.id };
      } catch (error) {
        if (error instanceof EvaluationProviderError) {
          throw new WorkflowWorkerError(
            formatProviderWorkflowMessage(error),
            error.code === "malformed_output" || error.code === "provider_unavailable"
              ? "terminal"
              : "retryable",
            error.code.toUpperCase(),
          );
        }
        throw error;
      }
    }),
    generate_report: createHandler(async (input) => {
      const context = buildContext(input.step, input.payload);
      const result = await reportingService.generateReport({
        context,
        interviewSessionId: input.step.workflowSubjectId as InterviewSessionId,
      });
      return { hrReportVersionId: result.id };
    }),
    notify_results_ready: createHandler(async (input) => {
      const context = buildContext(input.step, input.payload);
      const interviewSessionId = input.step.workflowSubjectId as InterviewSessionId;
      const count = await createResultsReadyNotificationIntents(context, interviewSessionId);
      return { notificationIntentCount: count };
    }),
  };
}

function formatProviderWorkflowMessage(error: EvaluationProviderError): string {
  const detailText = Object.entries(error.details)
    .filter((entry): entry is [string, string | number | boolean] =>
      ["string", "number", "boolean"].includes(typeof entry[1]),
    )
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  return detailText.length === 0 ? error.message : `${error.message} ${detailText}`;
}

async function createResultsReadyNotificationIntents(
  context: ReturnType<typeof buildContext>,
  interviewSessionId: InterviewSessionId,
): Promise<number> {
  const recipients = await prisma.user.findMany({
    where: {
      companyId: context.tenant.companyId,
      status: "ACTIVE",
      roles: {
        some: {
          role: {
            permissions: {
              some: {
                permission: {
                  key: "reports:read",
                },
              },
            },
          },
        },
      },
    },
    select: { id: true, email: true, name: true },
    take: 50,
  });
  let created = 0;
  for (const recipient of recipients) {
    const existing = await prisma.notificationIntent.findFirst({
      where: {
        companyId: context.tenant.companyId,
        type: "RESULTS_READY",
        recipientEmail: recipient.email.toLowerCase(),
        targetResourceType: "interview_session",
        targetResourceId: interviewSessionId,
      },
      select: { id: true },
    });
    if (existing !== null) {
      continue;
    }
    await prisma.notificationIntent.create({
      data: {
        companyId: context.tenant.companyId,
        type: "RESULTS_READY",
        channel: "EMAIL",
        recipientEmail: recipient.email.toLowerCase(),
        recipientName: recipient.name,
        targetResourceType: "interview_session",
        targetResourceId: interviewSessionId,
        payloadJson: {
          schemaVersion: 1,
          interviewSessionId,
          userId: recipient.id,
        },
      },
    });
    created += 1;
  }
  return created;
}

function createHandler(
  handler: (input: {
    readonly step: ProcessingWorkflowStepRecord & { readonly workflowSubjectId: string };
    readonly payload: WorkflowQueuePayload;
  }) => Promise<Record<string, unknown>>,
): WorkflowStepHandler {
  return {
    async handle(input) {
      const step = {
        ...input.step,
        workflowSubjectId: extractWorkflowSubjectId(input.step),
      };
      const checkpoint = await handler({ step, payload: input.payload });
      return { checkpoint };
    },
  };
}

function buildContext(step: ProcessingWorkflowStepRecord, payload: WorkflowQueuePayload) {
  return {
    tenant: createTenantContext(step.companyId),
    actor: { type: "system" as const, id: null },
    request: {
      requestId: payload.requestId,
      correlationId: payload.correlationId,
      sessionId: null,
      ipAddress: null,
      userAgent: "aptly-worker",
    },
  };
}

function extractWorkflowSubjectId(step: ProcessingWorkflowStepRecord): string {
  const subjectId = step.metadata.workflowSubjectId;
  if (typeof subjectId === "string" && subjectId.length > 0) {
    return subjectId;
  }
  throw new WorkflowWorkerError(
    "Workflow step is missing its subject identifier.",
    "terminal",
    "WORKFLOW_SUBJECT_ID_MISSING",
  );
}
