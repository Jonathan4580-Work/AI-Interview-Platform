import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "OIDC providers",
    description:
      "Google Workspace, Microsoft Entra ID, and development adapters share one contract.",
    status: "development",
  },
  {
    label: "Login policies",
    description: "Optional SSO, required SSO, and local break-glass Company Admin access.",
    status: "ready",
  },
  {
    label: "OAuth protections",
    description: "State, nonce, PKCE, redirect validation, and safe account-linking rules.",
    status: "ready",
  },
] as const;

export default function SsoSettingsPage() {
  return (
    <Phase12SettingsPage
      eyebrow="Integrations"
      title="Single Sign-On"
      description="Prepare enterprise identity connections without weakening local authentication."
      items={items}
    />
  );
}
