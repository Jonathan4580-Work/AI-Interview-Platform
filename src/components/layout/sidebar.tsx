import { AptlyLogo } from "@/components/brand/logo";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { cn } from "@/shared/utils/cn";

import type { ShellNavigationItem, ShellWorkspace } from "@/components/layout/navigation-types";

interface SidebarProps {
  navigation: readonly ShellNavigationItem[];
  workspace: ShellWorkspace;
  className?: string;
}

function Sidebar({ navigation, workspace, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden min-h-dvh w-64 shrink-0 border-r border-border bg-surface px-3 py-4 lg:flex lg:flex-col",
        className,
      )}
    >
      <div className="px-2 pb-4">
        <AptlyLogo />
      </div>
      <WorkspaceSwitcher workspace={workspace} className="mb-4 w-full" />
      <nav className="space-y-1" aria-label="Primary">
        {navigation.map((item) => (
          <a
            key={item.label}
            href={item.href ?? "#"}
            aria-current={item.current ? "page" : undefined}
            aria-disabled={item.disabled ? "true" : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate transition-colors duration-base hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              item.current && "bg-primary-soft text-primary",
              item.disabled && "pointer-events-none opacity-50",
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}

export { Sidebar };
