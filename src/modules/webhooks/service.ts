import { createEventPayloadAllowlist } from "@/modules/events";

import { validateWebhookEndpoint } from "./security";

import type { WebhookSubscriptionRecord, WebhookSubscriptionStore } from "./types";
import type { TenantContext } from "@/modules/tenant";

export const externallyDeliverableEventKeys = [
  "invitation.created",
  "invitation.sent",
  "interview.completed",
  "transcript.ready",
  "evaluation.ready",
  "report.ready",
  "export.ready",
  "workflow.failed",
] as const;

export type ExternallyDeliverableEventKey = (typeof externallyDeliverableEventKeys)[number];

export const webhookPayloadAllowlist = createEventPayloadAllowlist([
  "eventId",
  "eventKey",
  "schemaVersion",
  "companyId",
  "aggregateType",
  "aggregateId",
  "occurredAt",
  "resource",
]);

export class WebhookDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WebhookDomainError";
  }
}

export class WebhookSubscriptionService {
  public constructor(private readonly store: WebhookSubscriptionStore) {}

  public createSubscription(input: {
    readonly tenant: TenantContext;
    readonly name: string;
    readonly endpointUrl: string;
    readonly eventKeys: readonly string[];
    readonly signingSecretRef: string;
    readonly production?: boolean;
  }): Promise<WebhookSubscriptionRecord> {
    const name = input.name.trim();
    if (name.length < 3) {
      throw new WebhookDomainError("Webhook subscription name must be specific.");
    }
    if (!input.signingSecretRef.startsWith("secret://")) {
      throw new WebhookDomainError("Webhook signing secret must use a managed secret reference.");
    }
    const eventKeys = validateEventKeys(input.eventKeys);
    const endpoint = validateWebhookEndpoint(input.endpointUrl, {
      production: input.production,
    });

    return this.store.create({
      companyId: input.tenant.companyId,
      name,
      endpointUrl: endpoint.toString(),
      eventKeys,
      signingSecretRef: input.signingSecretRef,
      schemaVersion: "v1",
      maxAttempts: 8,
    });
  }
}

export function validateEventKeys(
  eventKeys: readonly string[],
): readonly ExternallyDeliverableEventKey[] {
  if (eventKeys.length === 0 || eventKeys.length > 25) {
    throw new WebhookDomainError("Webhook subscriptions require between 1 and 25 event keys.");
  }
  const allowed = new Set<string>(externallyDeliverableEventKeys);
  const invalid = eventKeys.filter((eventKey) => !allowed.has(eventKey));
  if (invalid.length > 0) {
    throw new WebhookDomainError(
      `Webhook event keys are not externally deliverable: ${invalid.join(", ")}.`,
    );
  }
  return [...new Set(eventKeys)] as ExternallyDeliverableEventKey[];
}

export function nextWebhookAttemptAt(input: {
  readonly attemptCount: number;
  readonly now?: Date;
}): Date {
  const now = input.now ?? new Date();
  const boundedAttempt = Math.min(Math.max(input.attemptCount, 0), 10);
  return new Date(now.getTime() + 2 ** boundedAttempt * 2_000);
}
