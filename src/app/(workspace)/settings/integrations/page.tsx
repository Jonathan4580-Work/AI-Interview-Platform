import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "Webhook subscriptions",
    description: "Send approved workspace events to secure external endpoints.",
  },
  {
    label: "Single sign-on",
    description: "Prepare Google Workspace or Microsoft Entra ID sign-in for your company.",
  },
  {
    label: "SCIM provisioning",
    description: "Automate user lifecycle changes from your identity provider.",
  },
  {
    label: "ATS connections",
    description: "Connect recruiting systems while keeping Aptly records controlled and auditable.",
  },
] as const;

export default function IntegrationsOverviewPage() {
  return (
    <Phase12SettingsPage
      eyebrow="Settings"
      title="Integrations"
      description="Manage enterprise connections and data-sharing settings for your workspace."
      items={items}
    />
  );
}
