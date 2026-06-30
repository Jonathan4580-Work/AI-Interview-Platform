import { env } from "@/config";

import { createManagedWorker } from "./workers";

import type {
  IntegrationQueuePayload,
  MediaQueuePayload,
  ProviderBoundQueuePayload,
  SafeQueueContext,
  WebhookQueuePayload,
} from "./contracts";
import type { ManagedWorker } from "./workers";

export interface QueuePayloadHandler<TPayload extends SafeQueueContext> {
  handle(payload: TPayload): Promise<void>;
}

export type QueuePayloadHandlerRegistry<TPayload extends SafeQueueContext> = Readonly<
  Partial<Record<string, QueuePayloadHandler<TPayload>>>
>;

export class QueueHandlerNotRegisteredError extends Error {
  public constructor(jobName: string) {
    super(`Queue handler is not registered for ${jobName}.`);
    this.name = "QueueHandlerNotRegisteredError";
  }
}

export function createMediaWorker(
  handlers: QueuePayloadHandlerRegistry<MediaQueuePayload>,
): ManagedWorker {
  return createManagedWorker<MediaQueuePayload>(
    {
      queueName: "media",
      concurrency: env.WORKER_MEDIA_CONCURRENCY,
    },
    async (job) => {
      const handler = handlers[job.name];
      if (handler === undefined) {
        throw new QueueHandlerNotRegisteredError(job.name);
      }
      await handler.handle(job.data);
    },
  );
}

export function createProviderBoundWorker(
  handlers: QueuePayloadHandlerRegistry<ProviderBoundQueuePayload>,
): ManagedWorker {
  return createManagedWorker<ProviderBoundQueuePayload>(
    {
      queueName: "provider-bound",
      concurrency: env.WORKER_PROVIDER_BOUND_CONCURRENCY,
    },
    async (job) => {
      const handler = handlers[job.name];
      if (handler === undefined) {
        throw new QueueHandlerNotRegisteredError(job.name);
      }
      await handler.handle(job.data);
    },
  );
}

export function createLightweightNotificationWorker(
  handlers: QueuePayloadHandlerRegistry<SafeQueueContext>,
): ManagedWorker {
  return createManagedWorker<SafeQueueContext>(
    {
      queueName: "notifications",
      concurrency: env.WORKER_NOTIFICATIONS_CONCURRENCY,
    },
    async (job) => {
      const handler = handlers[job.name];
      if (handler === undefined) {
        throw new QueueHandlerNotRegisteredError(job.name);
      }
      await handler.handle(job.data);
    },
  );
}

export function createIntegrationWorker(
  handlers: QueuePayloadHandlerRegistry<IntegrationQueuePayload>,
): ManagedWorker {
  return createManagedWorker<IntegrationQueuePayload>(
    {
      queueName: "integrations",
      concurrency: env.WORKER_INTEGRATIONS_CONCURRENCY,
    },
    async (job) => {
      const handler = handlers[job.name];
      if (handler === undefined) {
        throw new QueueHandlerNotRegisteredError(job.name);
      }
      await handler.handle(job.data);
    },
  );
}

export function createWebhookWorker(
  handlers: QueuePayloadHandlerRegistry<WebhookQueuePayload>,
): ManagedWorker {
  return createManagedWorker<WebhookQueuePayload>(
    {
      queueName: "webhooks",
      concurrency: env.WORKER_WEBHOOKS_CONCURRENCY,
    },
    async (job) => {
      const handler = handlers[job.name];
      if (handler === undefined) {
        throw new QueueHandlerNotRegisteredError(job.name);
      }
      await handler.handle(job.data);
    },
  );
}
