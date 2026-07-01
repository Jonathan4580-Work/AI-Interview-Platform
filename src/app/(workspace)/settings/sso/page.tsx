import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "OIDC providers",
    description: "Configure Google Workspace or Microsoft Entra ID as trusted sign-in providers.",
  },
  {
    label: "Login policies",
    description: "Optional SSO, required SSO, and local break-glass Company Admin access.",
  },
  {
    label: "OAuth protections",
    description: "State, nonce, PKCE, redirect validation, and safe account-linking rules.",
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
