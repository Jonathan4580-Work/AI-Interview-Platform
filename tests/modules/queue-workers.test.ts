import { describe, expect, it } from "vitest";

import {
  QueueHandlerNotRegisteredError,
  assertSafeQueuePayload,
  closeWorkersGracefully,
  createLightweightNotificationWorker,
  createMediaWorker,
  createProviderBoundWorker,
  redactQueuePayload,
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
