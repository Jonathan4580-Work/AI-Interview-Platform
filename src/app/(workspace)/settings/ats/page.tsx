import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "Provider adapters",
    description: "Prepare connections for Greenhouse, Lever, Workday, Ashby, and related systems.",
  },
  {
    label: "Record mapping",
    description: "Jobs, candidates, applications, stages, and users map through separate tables.",
  },
  {
    label: "Conflict policy",
    description: "Aptly wins, external wins, manual review, and field-specific rules are explicit.",
  },
] as const;

export default function AtsSettingsPage() {
  return (
    <Phase12SettingsPage
      eyebrow="Integrations"
      title="ATS Connections"
      description="Configure recruiting-system connections while protecting core Aptly records."
      items={items}
    />
  );
}
