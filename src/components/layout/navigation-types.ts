import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface ShellUser {
  name: string;
  email: string;
  initials: string;
  roleLabel: string;
}

export interface ShellWorkspace {
  name: string;
  planLabel?: string;
}

export interface ShellNavigationItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  current?: boolean;
  disabled?: boolean;
}

export interface ShellBreadcrumb {
  label: string;
  href?: string;
}

export interface ShellAction {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
}
