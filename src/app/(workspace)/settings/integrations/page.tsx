import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "Webhook subscriptions",
    description: "Tenant-managed delivery endpoints with HMAC signing and event allowlists.",
    status: "ready",
  },
  {
    label: "Single sign-on",
    description: "Google, Microsoft, and future SAML configuration foundations.",
    status: "development",
  },
  {
    label: "SCIM provisioning",
    description: "User and group provisioning architecture with hashed bearer-token handling.",
    status: "development",
  },
  {
    label: "ATS connections",
    description: "Provider-neutral connection, mapping, cursor, and conflict-policy foundations.",
    status: "development",
  },
] as const;

export default function IntegrationsOverviewPage() {
  return (
    <Phase12SettingsPage
      eyebrow="Settings"
      title="Integrations"
      description="Manage enterprise integration foundations without changing the core recruiting domain."
      items={items}
    />
  );
}
