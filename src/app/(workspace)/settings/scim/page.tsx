import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "SCIM 2.0 resources",
    description: "Manage users and groups from your identity provider with tenant-scoped mappings.",
  },
  {
    label: "Token safety",
    description: "Bearer tokens are hashed or referenced through managed secrets.",
  },
  {
    label: "Deprovisioning",
    description: "Deactivated users lose active sessions while audit history is preserved.",
  },
] as const;

export default function ScimSettingsPage() {
  return (
    <Phase12SettingsPage
      eyebrow="Integrations"
      title="SCIM Provisioning"
      description="Prepare enterprise user lifecycle automation through tenant-safe provisioning contracts."
      items={items}
    />
  );
}
