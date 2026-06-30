import { describe, expect, it } from "vitest";

import {
  WebhookDomainError,
  WebhookSecurityError,
  WebhookSubscriptionService,
  assertWebhookReplayAllowed,
  nextWebhookAttemptAt,
  signWebhook,
  validateWebhookEndpoint,
  verifyWebhookSignature,
  webhookPayloadAllowlist,
} from "@/modules/webhooks";
import { toTenantId } from "@/modules/tenant";

import type {
  WebhookSubscriptionId,
  WebhookSubscriptionRecord,
  WebhookSubscriptionStore,
} from "@/modules/webhooks";

describe("webhook foundation", () => {
  it("creates tenant-scoped subscriptions with deliverable event allowlists", async () => {
    const store = new MemoryWebhookSubscriptionStore();
    const service = new WebhookSubscriptionService(store);

    const subscription = await service.createSubscription({
      tenant,
      name: "Results webhook",
      endpointUrl: "https://integrations.example.com/aptly",
      eventKeys: ["interview.completed", "report.ready"],
      signingSecretRef: "secret://tenant/webhooks/results",
      production: true,
    });

    expect(subscription).toMatchObject({
      companyId,
      endpointUrl: "https://integrations.example.com/aptly",
      eventKeys: ["interview.completed", "report.ready"],
      status: "pending_verification",
      signingSecretRef: "secret://tenant/webhooks/results",
    });
  });

  it("rejects unsafe endpoints and non-secret signing configuration", () => {
    const service = new WebhookSubscriptionService(new MemoryWebhookSubscriptionStore());

    expect(() => validateWebhookEndpoint("https://127.0.0.1/hook", { production: true })).toThrow(
      WebhookSecurityError,
    );
    expect(() =>
      validateWebhookEndpoint("http://integrations.example.com/hook", { production: true }),
    ).toThrow(WebhookSecurityError);
    expect(() => {
      void service.createSubscription({
        tenant,
        name: "Bad webhook",
        endpointUrl: "https://integrations.example.com/aptly",
        eventKeys: ["report.ready"],
        signingSecretRef: "plain-secret",
      });
    }).toThrow(WebhookDomainError);
  });

  it("signs requests and rejects stale or replayed deliveries", () => {
    const timestamp = 1_782_864_000;
    const body = JSON.stringify({ eventId: "event_1" });
    const signature = signWebhook({
      secret: "test-secret",
      timestamp,
      eventId: "event_1",
      body,
    });

    expect(() => {
      verifyWebhookSignature({
        signature,
        secret: "test-secret",
        timestamp,
        eventId: "event_1",
        body,
        now: new Date(timestamp * 1000),
      });
    }).not.toThrow();

    expect(() => {
      verifyWebhookSignature({
        signature,
        secret: "test-secret",
        timestamp,
        eventId: "event_1",
        body,
        now: new Date((timestamp + 301) * 1000),
      });
    }).toThrow(WebhookSecurityError);

    expect(() => {
      assertWebhookReplayAllowed({
        eventId: "event_1",
        seenEventIds: new Set(["event_1"]),
      });
    }).toThrow(WebhookSecurityError);
  });

  it("allowlists outbound webhook payload fields and computes retry backoff", () => {
    expect(
      webhookPayloadAllowlist({
        eventId: "event_1",
        eventKey: "report.ready",
        schemaVersion: "v1",
        companyId,
        aggregateType: "hr_report",
        aggregateId: "report_1",
        occurredAt: "2026-07-01T00:00:00.000Z",
        resource: { id: "report_1", status: "ready" },
      }),
    ).toMatchObject({ eventId: "event_1" });

    expect(() =>
      webhookPayloadAllowlist({
        eventId: "event_1",
        transcriptText: "restricted content",
      }),
    ).toThrow("restricted key");

    expect(
      nextWebhookAttemptAt({
        attemptCount: 2,
        now: new Date("2026-07-01T00:00:00.000Z"),
      }).toISOString(),
    ).toBe("2026-07-01T00:00:08.000Z");
  });
});

const companyId = toTenantId("cwebhook001");
const tenant = { companyId };

class MemoryWebhookSubscriptionStore implements WebhookSubscriptionStore {
  private readonly subscriptions: WebhookSubscriptionRecord[] = [];

  public create(
    input: Parameters<WebhookSubscriptionStore["create"]>[0],
  ): Promise<WebhookSubscriptionRecord> {
    const subscription: WebhookSubscriptionRecord = {
      id: `webhook_${String(this.subscriptions.length + 1)}` as WebhookSubscriptionId,
      companyId: input.companyId,
      name: input.name,
      endpointUrl: input.endpointUrl,
      eventKeys: input.eventKeys,
      status: "pending_verification",
      signingSecretRef: input.signingSecretRef,
      schemaVersion: input.schemaVersion,
      maxAttempts: input.maxAttempts,
    };
    this.subscriptions.push(subscription);
    return Promise.resolve(subscription);
  }
}
