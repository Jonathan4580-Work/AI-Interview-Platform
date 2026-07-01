import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "Workflow-backed sync",
    description: "Sync jobs run in the background with durable checkpoints and retry controls.",
  },
  {
    label: "Cursor checkpoints",
    description: "Page processing is idempotent and resumable after retries or deployments.",
  },
  {
    label: "Provider throttling",
    description: "Rate-limit state, backoff, and partial failures stay isolated per connection.",
  },
] as const;

export default function IntegrationSyncSettingsPage() {
  return (
    <Phase12SettingsPage
      eyebrow="Integrations"
      title="Sync Status"
      description="Inspect integration sync checkpoints, retries, and replay controls."
      items={items}
    />
  );
}
