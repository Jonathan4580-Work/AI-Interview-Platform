import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "Workflow-backed sync",
    description: "Integration sync jobs use durable workflow and queue foundations.",
    status: "ready",
  },
  {
    label: "Cursor checkpoints",
    description: "Page processing is idempotent and resumable after retries or deployments.",
    status: "ready",
  },
  {
    label: "Provider throttling",
    description: "Rate-limit state, backoff, and partial failures stay isolated per connection.",
    status: "development",
  },
] as const;

export default function IntegrationSyncSettingsPage() {
  return (
    <Phase12SettingsPage
      eyebrow="Integrations"
      title="Sync Status"
      description="Inspect integration sync architecture, checkpoints, and replay controls."
      items={items}
    />
  );
}
