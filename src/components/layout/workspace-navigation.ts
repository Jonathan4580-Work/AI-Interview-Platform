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
import type { PermissionKey } from "@/modules/access-control";

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
  { label: "Overview", href: "/", icon: BarChart3, permission: undefined },
  { label: "Search", href: "/search", icon: Search, permission: "search:workspace" },
  { label: "Reports", href: "/reports", icon: BarChart3, permission: "reports:read" },
  {
    label: "Comparison",
    href: "/reports/comparison",
    icon: GitCompareArrows,
    permission: "reports:comparison_read",
  },
  { label: "Exports", href: "/exports", icon: Download, permission: "exports:read" },
  {
    label: "Settings",
    href: "/settings/integrations",
    icon: Settings,
    permission: "integrations:read",
  },
  { label: "Webhooks", href: "/settings/webhooks", icon: Link2, permission: "webhooks:read" },
  { label: "SSO", href: "/settings/sso", icon: KeyRound, permission: "sso:read" },
  { label: "SCIM", href: "/settings/scim", icon: ShieldCheck, permission: "scim:read" },
  { label: "ATS", href: "/settings/ats", icon: Network, permission: "integrations:read" },
  {
    label: "Sync",
    href: "/settings/integration-sync",
    icon: Globe2,
    permission: "integration_syncs:read",
  },
  {
    label: "Data region",
    href: "/settings/data-region",
    icon: Database,
    permission: "data_residency:read",
  },
] as const satisfies readonly NavigationDefinition[];

const platformNavigationDefinitions = companyNavigationDefinitions.filter((item) =>
  item.href.startsWith("/settings"),
);

export function createWorkspaceNavigation(
  pathname: string,
  audience: ShellAudience = "company",
  permissions?: ReadonlySet<PermissionKey>,
): readonly ShellNavigationItem[] {
  const definitions =
    audience === "platform" ? platformNavigationDefinitions : companyNavigationDefinitions;

  return definitions
    .filter(
      (item) =>
        audience === "platform" ||
        permissions === undefined ||
        item.permission === undefined ||
        permissions.has(item.permission),
    )
    .map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      current: isCurrentNavigationItem(pathname, item.href),
    }));
}

type NavigationDefinition = Omit<ShellNavigationItem, "current"> & {
  readonly permission?: PermissionKey;
};

function isCurrentNavigationItem(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/settings/integrations") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
