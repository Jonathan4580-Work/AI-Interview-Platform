import type { TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type WebhookSubscriptionId = Brand<string, "WebhookSubscriptionId">;
export type WebhookDeliveryId = Brand<string, "WebhookDeliveryId">;

export const webhookSubscriptionStatuses = [
  "enabled",
  "disabled",
  "pending_verification",
  "failed",
] as const;

export type WebhookSubscriptionStatus = (typeof webhookSubscriptionStatuses)[number];

export interface WebhookSubscriptionRecord {
  readonly id: WebhookSubscriptionId;
  readonly companyId: TenantId;
  readonly name: string;
  readonly endpointUrl: string;
  readonly eventKeys: readonly string[];
  readonly status: WebhookSubscriptionStatus;
  readonly signingSecretRef: string;
  readonly schemaVersion: string;
  readonly maxAttempts: number;
}

export interface WebhookSubscriptionStore {
  create(input: {
    readonly companyId: TenantId;
    readonly name: string;
    readonly endpointUrl: string;
    readonly eventKeys: readonly string[];
    readonly signingSecretRef: string;
    readonly schemaVersion: string;
    readonly maxAttempts: number;
  }): Promise<WebhookSubscriptionRecord>;
}
