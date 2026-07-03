import { Queue } from "bullmq";

import { env } from "@/config";

import { LocalQueueAdapter } from "./local-queue";
import type { QueueName } from "./queue-names";

export function createQueue(name: QueueName): Queue | LocalQueueAdapter {
  if (env.APP_ENV === "development") {
    return new LocalQueueAdapter(name);
  }
  return new Queue(name, {
    connection: {
      url: env.REDIS_URL,
      maxRetriesPerRequest: null,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1_000,
      },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
}
