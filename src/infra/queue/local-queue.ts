import type { Prisma } from "@prisma/client";

import { prisma } from "@/infra/database";

import type { QueueName } from "./queue-names";

export interface LocalQueueJobOptions {
  readonly jobId?: string;
  readonly attempts?: number;
  readonly delay?: number;
}

export class LocalQueueAdapter {
  public constructor(private readonly name: QueueName) {}

  public async add(
    jobName: string,
    data: unknown,
    options: LocalQueueJobOptions = {},
  ): Promise<{ readonly id: string }> {
    const availableAt = new Date(Date.now() + (options.delay ?? 0));
    const idempotencyKey = options.jobId ?? `${this.name}:${jobName}:${JSON.stringify(data)}`;
    const existing = await prisma.localJob.findUnique({ where: { idempotencyKey } });
    if (existing !== null) {
      return { id: existing.id };
    }
    const job = await prisma.localJob.create({
      data: {
        type: `${this.name}:${jobName}`,
        payloadJson: safePayload(data),
        maxAttempts: options.attempts ?? 5,
        availableAt,
        idempotencyKey,
      },
    });
    return { id: job.id };
  }
}

function safePayload(data: unknown): Prisma.InputJsonValue {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {};
  }
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}
