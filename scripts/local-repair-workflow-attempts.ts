import { env } from "@/config";
import { prisma } from "@/infra/database";

import type { Prisma } from "@prisma/client";

const workflowId = process.argv.at(2) ?? process.env.LOCAL_REPAIR_WORKFLOW_ID;

if (env.APP_ENV !== "development") {
  throw new Error("local:repair-workflow-attempts may only run with APP_ENV=development.");
}

if (workflowId === undefined || workflowId.trim().length === 0) {
  throw new Error("Usage: npm run local:repair-workflow-attempts -- <processingWorkflowId>");
}

const targetWorkflowId = workflowId.trim();
const repairedAt = new Date();

const result = await prisma.$transaction(async (tx) => {
  const workflow = await tx.processingWorkflow.findUnique({
    where: { id: targetWorkflowId },
    include: {
      steps: {
        orderBy: { sequence: "asc" },
        include: { attempts: { orderBy: { attemptNumber: "desc" } } },
      },
    },
  });

  if (workflow === null) {
    throw new Error(`Workflow not found: ${targetWorkflowId}`);
  }

  const repairedAttempts: string[] = [];
  const resetSteps: string[] = [];

  for (const step of workflow.steps) {
    const attemptNumber = Math.max(step.attemptCount, 1);
    const existingAttempt = step.attempts.find(
      (attempt) => attempt.attemptNumber === attemptNumber,
    );

    if (step.status === "SUCCEEDED") {
      const completedAt = step.completedAt ?? repairedAt;
      await tx.workflowStepAttempt.upsert({
        where: {
          companyId_stepId_attemptNumber: {
            companyId: step.companyId,
            stepId: step.id,
            attemptNumber,
          },
        },
        create: {
          companyId: step.companyId,
          workflowId: step.workflowId,
          stepId: step.id,
          attemptNumber,
          status: "SUCCEEDED",
          startedAt: step.startedAt ?? completedAt,
          completedAt,
          checkpointJson: toInputJson(step.checkpointJson),
          metadataJson: {},
        },
        update: {
          status: "SUCCEEDED",
          failureKind: null,
          errorCode: null,
          errorMessage: null,
          completedAt,
          checkpointJson: toInputJson(step.checkpointJson),
        },
      });
      if (existingAttempt?.status !== "SUCCEEDED" || existingAttempt.completedAt === null) {
        repairedAttempts.push(step.stepKey);
      }
      continue;
    }

    if (step.status === "FAILED") {
      const completedAt = step.failedAt ?? repairedAt;
      await tx.workflowStepAttempt.upsert({
        where: {
          companyId_stepId_attemptNumber: {
            companyId: step.companyId,
            stepId: step.id,
            attemptNumber,
          },
        },
        create: {
          companyId: step.companyId,
          workflowId: step.workflowId,
          stepId: step.id,
          attemptNumber,
          status: "FAILED",
          failureKind: step.failureKind,
          errorCode: step.failureCode,
          errorMessage: step.failureMessage,
          startedAt: step.startedAt ?? completedAt,
          completedAt,
          checkpointJson: toInputJson(step.checkpointJson),
          metadataJson: {},
        },
        update: {
          status: "FAILED",
          failureKind: step.failureKind,
          errorCode: step.failureCode,
          errorMessage: step.failureMessage,
          completedAt,
          checkpointJson: toInputJson(step.checkpointJson),
        },
      });
      if (existingAttempt?.status !== "FAILED" || existingAttempt.completedAt === null) {
        repairedAttempts.push(step.stepKey);
      }

      await tx.processingWorkflowStep.update({
        where: { companyId_id: { companyId: step.companyId, id: step.id } },
        data: {
          status: "PENDING",
          nextRunAt: null,
          failureKind: null,
          failureCode: null,
          failureMessage: null,
          failedAt: null,
        },
      });
      resetSteps.push(step.stepKey);
    }
  }

  const remaining = await tx.processingWorkflowStep.findMany({
    where: { companyId: workflow.companyId, workflowId: workflow.id },
    select: { status: true },
  });
  const allComplete = remaining.every(
    (step) => step.status === "SUCCEEDED" || step.status === "SKIPPED",
  );

  await tx.processingWorkflow.update({
    where: { companyId_id: { companyId: workflow.companyId, id: workflow.id } },
    data: allComplete
      ? {
          status: "COMPLETED",
          currentStepKey: null,
          completedAt: workflow.completedAt ?? repairedAt,
          failureKind: null,
          failureCode: null,
          failureMessage: null,
        }
      : {
          status: "RUNNING",
          currentStepKey: resetSteps[0] ?? workflow.currentStepKey,
          failureKind: null,
          failureCode: null,
          failureMessage: null,
          failedAt: null,
        },
  });

  return {
    workflowId: workflow.id,
    companyId: workflow.companyId,
    repairedAttempts,
    resetSteps,
    workflowStatus: allComplete ? "COMPLETED" : "RUNNING",
  };
});

console.log("Local workflow attempt repair complete.");
console.log(`Workflow ID: ${result.workflowId}`);
console.log(`Company ID: ${result.companyId}`);
console.log(`Workflow status: ${result.workflowStatus}`);
console.log(
  `Attempts repaired: ${
    result.repairedAttempts.length === 0 ? "none" : result.repairedAttempts.join(", ")
  }`,
);
console.log(
  `Steps reset for retry: ${result.resetSteps.length === 0 ? "none" : result.resetSteps.join(", ")}`,
);

await prisma.$disconnect();

function toInputJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
