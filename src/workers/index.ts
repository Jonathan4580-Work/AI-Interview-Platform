import { logger } from "@/infra/logging";

let shutdownRequested = false;

logger.info("Worker process started with no business processors registered.");

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

  logger.info("Worker process stopped.");
}
