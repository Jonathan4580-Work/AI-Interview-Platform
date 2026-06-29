import { Queue } from "bullmq";

import { env } from "@/config";

import type { QueueName } from "./queue-names";

export function createQueue(name: QueueName): Queue {
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
