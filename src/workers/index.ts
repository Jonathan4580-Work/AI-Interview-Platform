import { logger } from "@/infra/logging";
import { closeWorkersGracefully } from "@/infra/queue";
import { assertEmailQueueRegistered, createEmailWorker } from "@/modules/email/worker";
import { createPhase9WorkflowHandlers } from "@/modules/evaluation/workflow-handlers";
import { createWorkflowOrchestrationWorker } from "@/modules/workflows";

let shutdownRequested = false;
const workers = [
  createEmailWorker(),
  createWorkflowOrchestrationWorker(createPhase9WorkflowHandlers()),
];

assertEmailQueueRegistered();
logger.info({ workerCount: workers.length }, "Worker process started.");

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
