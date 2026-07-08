import { env } from "@/config";
import { PrismaAiGovernanceRepository } from "@/modules/ai-governance";
import { AI_REDACTION_POLICY_VERSION, redactEvaluationInput } from "@/modules/ai-governance";
import {
  OpenAIEvaluationProvider,
  buildOpenAIEvaluationDiagnostics,
  buildOpenAIEvaluationProviderInput,
  formatSafeProviderError,
} from "@/modules/evaluation";
import { PrismaEvaluationRepository } from "@/modules/evaluation/prisma-evaluation-repository";
import { createTenantContext } from "@/modules/tenant";
import { prisma } from "@/infra/database";

import type { InterviewSessionId } from "@/modules/invitations";

const workflowId = process.argv.at(2) ?? process.env.LOCAL_EVALUATION_DIAGNOSTIC_WORKFLOW_ID;

if (env.APP_ENV !== "development") {
  throw new Error("local:evaluation-diagnostic may only run with APP_ENV=development.");
}

if (workflowId === undefined || workflowId.trim().length === 0) {
  throw new Error("Usage: npm run local:evaluation-diagnostic -- <processingWorkflowId>");
}

if (env.EVALUATION_PROVIDER !== "openai") {
  throw new Error("local:evaluation-diagnostic requires EVALUATION_PROVIDER=openai.");
}

if (!env.OPENAI_API_KEY) {
  throw new Error("local:evaluation-diagnostic requires OPENAI_API_KEY.");
}

const workflow = await prisma.processingWorkflow.findUnique({
  where: { id: workflowId.trim() },
  select: {
    id: true,
    companyId: true,
    subjectId: true,
    subjectType: true,
    status: true,
    steps: {
      orderBy: { sequence: "asc" },
      select: {
        stepKey: true,
        status: true,
        failureCode: true,
        failureMessage: true,
      },
    },
  },
});

if (workflow === null) {
  throw new Error(`Workflow not found: ${workflowId}`);
}

const tenant = createTenantContext(workflow.companyId);
const interviewSessionId = workflow.subjectId as InterviewSessionId;
const evaluationRepository = new PrismaEvaluationRepository();
const governanceRepository = new PrismaAiGovernanceRepository();
const bundle = await evaluationRepository.loadTranscriptBundle({
  tenant,
  interviewSessionId,
});

if (bundle === null) {
  throw new Error("Workflow interview does not have a ready transcript bundle.");
}

const governance = await governanceRepository.ensurePublishedEvaluationArtifacts({ tenant });
const redactedInput = redactEvaluationInput({
  interviewSessionId,
  transcriptVersionId: bundle.transcriptVersionId,
  rubric: governance.rubric,
  segments: bundle.segments,
});
const providerInput = buildOpenAIEvaluationProviderInput({ redactedInput, governance });
const diagnostics = buildOpenAIEvaluationDiagnostics({ redactedInput, governance });

console.log(
  JSON.stringify(
    {
      workflow: {
        id: workflow.id,
        status: workflow.status,
        subjectType: workflow.subjectType,
        interviewSessionId,
        steps: workflow.steps,
      },
      transcript: {
        transcriptVersionId: bundle.transcriptVersionId,
        segmentCount: bundle.segments.length,
        preview: bundle.segments.map((segment) => ({
          id: segment.id,
          sequence: segment.sequence,
          text: preview(segment.text),
        })),
      },
      evaluationRequest: {
        ...diagnostics,
        promptInputLength: providerInput.length,
        redactionPolicyVersion: AI_REDACTION_POLICY_VERSION,
      },
    },
    null,
    2,
  ),
);

try {
  const result = await new OpenAIEvaluationProvider().evaluate({ redactedInput, governance });
  console.log(
    JSON.stringify(
      {
        openaiEvaluation: {
          success: true,
          provider: result.provider,
          model: result.providerModel,
          overallScore: result.overallScore,
          overallConfidence: result.overallConfidence,
          competencyCount: result.competencies.length,
          usage: result.usage,
          estimatedCostCents: result.estimatedCostCents,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        openaiEvaluation: {
          success: false,
          error: formatSafeProviderError(error),
        },
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

function preview(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, 240);
}
