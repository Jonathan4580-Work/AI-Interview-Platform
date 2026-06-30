import { Worker, type Job } from "bullmq";
import type { Queue } from "bullmq";

import { env } from "@/config";
import { createQueue } from "@/infra/queue";
import { queueNames } from "@/infra/queue/queue-names";
import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import { createTenantContext } from "@/modules/tenant";

import { DefaultEmailProviderFactory } from "./provider-factory";
import { PrismaEmailRepository } from "./prisma-email-repository";
import { EmailService, type EmailDeliveryJob } from "./service";
import type { EmailDeliveryId } from "./types";

export function createEmailWorker(): Worker<EmailDeliveryJob> {
  const repository = new PrismaEmailRepository();
  const emailQueue = createQueue("email") as Queue<EmailDeliveryJob>;
  const service = new EmailService(
    repository,
    new DefaultEmailProviderFactory(),
    emailQueue,
    new AuditWriter(new PrismaAuditEventStore()),
  );

  return new Worker<EmailDeliveryJob>(
    "email",
    async (job: Job<EmailDeliveryJob>) => {
      await service.processQueuedDelivery({
        tenant: createTenantContext(job.data.companyId),
        deliveryId: job.data.deliveryId as EmailDeliveryId,
      });
    },
    {
      connection: {
        url: env.REDIS_URL,
        maxRetriesPerRequest: null,
      },
      concurrency: 5,
    },
  );
}

export function assertEmailQueueRegistered(): void {
  if (!queueNames.includes("email")) {
    throw new Error("Email queue is not registered.");
  }
}
