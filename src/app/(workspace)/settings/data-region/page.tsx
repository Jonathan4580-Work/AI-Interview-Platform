import { Phase12SettingsPage } from "@/components/settings/phase12-settings-page";

const items = [
  {
    label: "Tenant region",
    description: "Set the primary region policy for workspace data residency.",
  },
  {
    label: "Region-aware storage",
    description: "Storage policy follows the selected region where configured.",
  },
  {
    label: "Transfer restrictions",
    description: "Cross-region movement requires explicit policy and never occurs automatically.",
  },
] as const;

export default function DataRegionSettingsPage() {
  return (
    <Phase12SettingsPage
      eyebrow="Settings"
      title="Data Region"
      description="Review data-residency settings and cross-region transfer policy."
      items={items}
    />
  );
}
