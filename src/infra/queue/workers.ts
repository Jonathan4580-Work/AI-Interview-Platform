import { Worker, type Job } from "bullmq";

import { env } from "@/config";
import { logger } from "@/infra/logging";

import { assertSafeQueuePayload, redactQueuePayload } from "./contracts";

import type { QueueName } from "./queue-names";
import type { SafeQueueContext } from "./contracts";

export interface ManagedWorker {
  readonly queueName: QueueName;
  close(): Promise<void>;
  drain(): Promise<void>;
}

export interface BullMqClosableWorker {
  close(): Promise<void>;
  pause(doNotWaitActive?: boolean): Promise<void>;
}

export interface WorkerRuntimeOptions {
  readonly queueName: QueueName;
  readonly concurrency: number;
}

export function createManagedWorker<TPayload extends SafeQueueContext>(
  options: WorkerRuntimeOptions,
  processor: (job: Job<TPayload>) => Promise<void>,
): ManagedWorker {
  const worker = new Worker<TPayload>(
    options.queueName,
    async (job) => {
      assertSafeQueuePayload(job.data);
      logger.info(
        {
          queueName: options.queueName,
          jobName: job.name,
          jobId: job.id,
          payload: redactQueuePayload(job.data),
        },
        "Worker job started.",
      );
      await processor(job);
      logger.info(
        {
          queueName: options.queueName,
          jobName: job.name,
          jobId: job.id,
        },
        "Worker job completed.",
      );
    },
    {
      connection: {
        url: env.REDIS_URL,
        maxRetriesPerRequest: null,
      },
      concurrency: options.concurrency,
    },
  );

  worker.on("failed", (job, error) => {
    logger.error(
      {
        queueName: options.queueName,
        jobName: job?.name,
        jobId: job?.id,
        errorName: error.name,
        errorMessage: error.message,
        payload: job === undefined ? null : redactQueuePayload(job.data),
      },
      "Worker job failed.",
    );
  });

  return {
    queueName: options.queueName,
    close: () => worker.close(),
    drain: () => worker.pause(true),
  };
}

export async function closeWorkersGracefully(
  workers: readonly (ManagedWorker | BullMqClosableWorker)[],
): Promise<void> {
  await Promise.all(workers.map((worker) => drainWorker(worker)));
  await Promise.all(workers.map((worker) => worker.close()));
}

function drainWorker(worker: ManagedWorker | BullMqClosableWorker): Promise<void> {
  if ("drain" in worker) {
    return worker.drain();
  }
  return worker.pause(true);
}
