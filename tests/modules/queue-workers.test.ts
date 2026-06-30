import { describe, expect, it } from "vitest";

import {
  QueueHandlerNotRegisteredError,
  assertSafeQueuePayload,
  assertWorkerDeploymentCompatible,
  calculateTenantFairnessRatio,
  closeWorkersGracefully,
  createIntegrationWorker,
  createLightweightNotificationWorker,
  createMediaWorker,
  createProviderBoundWorker,
  createWebhookWorker,
  getWorkerClassPolicies,
  queueNames,
  redactQueuePayload,
  shouldThrottleTenantQueue,
} from "@/infra/queue";

describe("queue worker contracts", () => {
  it("redacts sensitive queue payload fields before logging", () => {
    const redacted = redactQueuePayload({
      companyId: "company_1",
      requestId: "req_1",
      correlationId: "corr_1",
      signedUrl: "https://storage.example.com/object",
      nested: {
        secretRef: "secret/object-storage",
        mediaBytes: "raw",
      },
    });

    expect(redacted).toEqual({
      companyId: "company_1",
      requestId: "req_1",
      correlationId: "corr_1",
      signedUrl: "[redacted]",
      nested: {
        secretRef: "[redacted]",
        mediaBytes: "[redacted]",
      },
    });
  });

  it("rejects payloads that include URLs or secret markers", () => {
    expect(() => {
      assertSafeQueuePayload({
        companyId: "company_1",
        requestId: "req_1",
        correlationId: "corr_1",
      });
    }).not.toThrow();

    expect(() => {
      assertSafeQueuePayload({
        companyId: "company_1",
        requestId: "req_1",
        correlationId: "corr_1",
        signedUrl: "https://storage.example.com/object",
      } as never);
    }).toThrow("Queue payload contains data");
  });

  it("exposes workload-specific worker factories with explicit handler registries", () => {
    expect(QueueHandlerNotRegisteredError).toBeDefined();
    expect(createMediaWorker).toBeDefined();
    expect(createProviderBoundWorker).toBeDefined();
    expect(createLightweightNotificationWorker).toBeDefined();
    expect(createIntegrationWorker).toBeDefined();
    expect(createWebhookWorker).toBeDefined();
  });

  it("defines a scaling policy for every queue class", () => {
    const policies = getWorkerClassPolicies();

    expect(policies.map((policy) => policy.queueName).sort()).toEqual([...queueNames].sort());
    expect(policies.every((policy) => policy.concurrency > 0)).toBe(true);
    expect(policies.every((policy) => policy.tenantFairnessLimit > 0)).toBe(true);
  });

  it("applies deterministic tenant fairness signals", () => {
    expect(
      shouldThrottleTenantQueue({
        queueName: "integrations",
        companyId: "company_1",
        activeJobs: 10,
        waitingJobs: 4,
      }),
    ).toBe(true);

    expect(
      calculateTenantFairnessRatio({
        queueName: "integrations",
        companyId: "company_1",
        activeJobs: 5,
        waitingJobs: 0,
      }),
    ).toBe(0.5);
  });

  it("rejects worker deployments with incompatible queue contracts", () => {
    expect(() => {
      assertWorkerDeploymentCompatible({
        workerClass: "webhooks",
        version: "2026.07.01",
        compatibleSchemaVersion: 1,
        deployedAt: new Date("2026-07-01T00:00:00.000Z"),
      });
    }).not.toThrow();

    expect(() => {
      assertWorkerDeploymentCompatible({
        workerClass: "webhooks",
        version: "2026.07.01",
        compatibleSchemaVersion: 0,
        deployedAt: new Date("2026-07-01T00:00:00.000Z"),
      });
    }).toThrow("not compatible");
  });

  it("drains workers before closing and waits for active jobs", async () => {
    const calls: string[] = [];
    const worker = {
      pause: (doNotWaitActive?: boolean) => {
        calls.push(`pause:${String(doNotWaitActive)}`);
        return Promise.resolve();
      },
      close: () => {
        calls.push("close");
        return Promise.resolve();
      },
    };

    await closeWorkersGracefully([worker]);

    expect(calls).toEqual(["pause:false", "close"]);
  });
});
