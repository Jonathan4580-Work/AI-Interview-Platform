import { env } from "@/config";

import type { QueueName } from "./queue-names";

export type WorkerResourceClass = "cpu" | "io" | "provider" | "lightweight";

export interface WorkerClassPolicy {
  readonly queueName: QueueName;
  readonly resourceClass: WorkerResourceClass;
  readonly concurrency: number;
  readonly tenantFairnessLimit: number;
  readonly providerBound: boolean;
  readonly autoscaleMetric: "queue_age" | "queue_depth" | "provider_throttle" | "latency";
}

export interface WorkerDeploymentMetadata {
  readonly workerClass: QueueName;
  readonly version: string;
  readonly compatibleSchemaVersion: number;
  readonly deployedAt: Date;
}

export interface TenantQueueSnapshot {
  readonly queueName: QueueName;
  readonly companyId: string;
  readonly activeJobs: number;
  readonly waitingJobs: number;
}

export const workerSchemaVersion = 1;

export function getWorkerClassPolicies(): readonly WorkerClassPolicy[] {
  return [
    policy("email", "provider", env.WORKER_NOTIFICATIONS_CONCURRENCY, true, "provider_throttle"),
    policy(
      "orchestration",
      "lightweight",
      env.WORKER_ORCHESTRATION_CONCURRENCY,
      false,
      "queue_age",
    ),
    policy("media", "io", env.WORKER_MEDIA_CONCURRENCY, false, "latency"),
    policy(
      "provider-bound",
      "provider",
      env.WORKER_PROVIDER_BOUND_CONCURRENCY,
      true,
      "provider_throttle",
    ),
    policy(
      "interview-maintenance",
      "lightweight",
      env.WORKER_ORCHESTRATION_CONCURRENCY,
      false,
      "queue_age",
    ),
    policy("media-finalization", "io", env.WORKER_MEDIA_CONCURRENCY, false, "queue_age"),
    policy(
      "transcription",
      "provider",
      env.WORKER_TRANSCRIPTION_CONCURRENCY,
      true,
      "provider_throttle",
    ),
    policy("evaluation", "provider", env.WORKER_EVALUATION_CONCURRENCY, true, "provider_throttle"),
    policy("reporting", "cpu", env.WORKER_REPORTING_CONCURRENCY, false, "latency"),
    policy("exports", "io", env.WORKER_EXPORTS_CONCURRENCY, false, "queue_age"),
    policy("retention", "io", env.WORKER_RETENTION_CONCURRENCY, false, "queue_age"),
    policy(
      "integrations",
      "provider",
      env.WORKER_INTEGRATIONS_CONCURRENCY,
      true,
      "provider_throttle",
    ),
    policy("webhooks", "provider", env.WORKER_WEBHOOKS_CONCURRENCY, true, "provider_throttle"),
    policy(
      "notifications",
      "lightweight",
      env.WORKER_NOTIFICATIONS_CONCURRENCY,
      false,
      "queue_depth",
    ),
  ];
}

export function getWorkerClassPolicy(queueName: QueueName): WorkerClassPolicy {
  const found = getWorkerClassPolicies().find(
    (policyDefinition) => policyDefinition.queueName === queueName,
  );
  if (found === undefined) {
    throw new Error(`Worker class policy is not configured for queue ${queueName}.`);
  }
  return found;
}

export function assertWorkerDeploymentCompatible(metadata: WorkerDeploymentMetadata): void {
  if (metadata.compatibleSchemaVersion !== workerSchemaVersion) {
    throw new Error("Worker deployment is not compatible with the active queue contract version.");
  }
}

export function shouldThrottleTenantQueue(snapshot: TenantQueueSnapshot): boolean {
  const policyDefinition = getWorkerClassPolicy(snapshot.queueName);
  return snapshot.activeJobs >= policyDefinition.tenantFairnessLimit;
}

export function calculateTenantFairnessRatio(snapshot: TenantQueueSnapshot): number {
  const policyDefinition = getWorkerClassPolicy(snapshot.queueName);
  return Math.min(1, snapshot.activeJobs / policyDefinition.tenantFairnessLimit);
}

function policy(
  queueName: QueueName,
  resourceClass: WorkerResourceClass,
  concurrency: number,
  providerBound: boolean,
  autoscaleMetric: WorkerClassPolicy["autoscaleMetric"],
): WorkerClassPolicy {
  return {
    queueName,
    resourceClass,
    concurrency,
    tenantFairnessLimit: env.WORKER_TENANT_FAIRNESS_LIMIT,
    providerBound,
    autoscaleMetric,
  };
}
