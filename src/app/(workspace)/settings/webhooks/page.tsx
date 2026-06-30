import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "Endpoint verification",
    description: "HTTPS validation, private-network blocking, and controlled redirect behavior.",
    status: "ready",
  },
  {
    label: "Signed delivery",
    description: "HMAC signatures, replay protection, retries, and dead-letter handling contracts.",
    status: "ready",
  },
  {
    label: "Payload allowlists",
    description: "External webhooks receive schema-versioned safe payloads only.",
    status: "ready",
  },
] as const;

export default function WebhookSettingsPage() {
  return (
    <Phase12SettingsPage
      eyebrow="Integrations"
      title="Webhook Subscriptions"
      description="Configure external event delivery with tenant-safe signing and replay protection."
      items={items}
    />
  );
}
