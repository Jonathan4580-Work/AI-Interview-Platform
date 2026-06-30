import { logger } from "@/infra/logging";
import { assertEmailQueueRegistered, createEmailWorker } from "@/modules/email/worker";

let shutdownRequested = false;
const workers = [createEmailWorker()];

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

  await Promise.all(workers.map((worker) => worker.close()));
  logger.info("Worker process stopped.");
}
