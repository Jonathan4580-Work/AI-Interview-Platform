import {
  BarChart3,
  Database,
  Download,
  GitCompareArrows,
  Globe2,
  KeyRound,
  Link2,
  Network,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";

import type { ShellNavigationItem } from "@/components/layout/navigation-types";

export const workspaceNavigationRoutes = [
  "/",
  "/search",
  "/reports",
  "/reports/comparison",
  "/exports",
  "/settings/integrations",
  "/settings/webhooks",
  "/settings/sso",
  "/settings/scim",
  "/settings/ats",
  "/settings/integration-sync",
  "/settings/data-region",
] as const;

export const platformNavigationRoutes = [
  "/settings/integrations",
  "/settings/webhooks",
  "/settings/sso",
  "/settings/scim",
  "/settings/ats",
  "/settings/integration-sync",
  "/settings/data-region",
] as const;

export const shellAudienceStorageKey = "aptly_shell_audience";

export type ShellAudience = "company" | "platform";

const companyNavigationDefinitions = [
  { label: "Overview", href: "/", icon: BarChart3 },
  { label: "Search", href: "/search", icon: Search },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Comparison", href: "/reports/comparison", icon: GitCompareArrows },
  { label: "Exports", href: "/exports", icon: Download },
  { label: "Settings", href: "/settings/integrations", icon: Settings },
  { label: "Webhooks", href: "/settings/webhooks", icon: Link2 },
  { label: "SSO", href: "/settings/sso", icon: KeyRound },
  { label: "SCIM", href: "/settings/scim", icon: ShieldCheck },
  { label: "ATS", href: "/settings/ats", icon: Network },
  { label: "Sync", href: "/settings/integration-sync", icon: Globe2 },
  { label: "Data region", href: "/settings/data-region", icon: Database },
] as const satisfies readonly Omit<ShellNavigationItem, "current">[];

const platformNavigationDefinitions = companyNavigationDefinitions.filter((item) =>
  item.href.startsWith("/settings"),
);

export function createWorkspaceNavigation(
  pathname: string,
  audience: ShellAudience = "company",
): readonly ShellNavigationItem[] {
  const definitions =
    audience === "platform" ? platformNavigationDefinitions : companyNavigationDefinitions;

  return definitions.map((item) => ({
    ...item,
    current: isCurrentNavigationItem(pathname, item.href),
  }));
}

function isCurrentNavigationItem(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/settings/integrations") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
