import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "Provider adapters",
    description:
      "Development ATS adapter plus boundaries for Greenhouse, Lever, Workday, Ashby, and others.",
    status: "development",
  },
  {
    label: "Mapping foundation",
    description: "Jobs, candidates, applications, stages, and users map through separate tables.",
    status: "ready",
  },
  {
    label: "Conflict policy",
    description: "Aptly wins, external wins, manual review, and field-specific rules are explicit.",
    status: "ready",
  },
] as const;

export default function AtsSettingsPage() {
  return (
    <Phase12SettingsPage
      eyebrow="Integrations"
      title="ATS Connections"
      description="Configure provider-neutral ATS integration foundations without polluting core records."
      items={items}
    />
  );
}
