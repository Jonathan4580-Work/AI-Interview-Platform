import { logger } from "@/infra/logging";
import { closeWorkersGracefully } from "@/infra/queue";
import { assertEmailQueueRegistered, createEmailWorker } from "@/modules/email/worker";
import { createPhase9WorkflowHandlers } from "@/modules/evaluation/workflow-handlers";
import { createWorkflowOrchestrationWorker } from "@/modules/workflows";

let shutdownRequested = false;
const workflowStepHandlers = createPhase9WorkflowHandlers();
const registeredWorkerClasses = [
  "email",
  "orchestration",
  "media-finalization",
  "transcription",
  "evaluation",
  "reporting",
  "results-notifications",
] as const;
const workers = [createEmailWorker(), createWorkflowOrchestrationWorker(workflowStepHandlers)];

assertEmailQueueRegistered();
logger.info(
  {
    workerCount: workers.length,
    workerClasses: registeredWorkerClasses,
    workflowStepHandlers: Object.keys(workflowStepHandlers).sort(),
  },
  "Worker process started.",
);

process.on("SIGINT", requestShutdown);
process.on("SIGTERM", requestShutdown);

await keepWorkerAlive();

function requestShutdown(): void {
  shutdownRequested = true;
}

async function keepWorkerAlive(): Promise<void> {
  while (!shutdownRequested) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  await closeWorkersGracefully(workers);
  logger.info("Worker process stopped.");
}
