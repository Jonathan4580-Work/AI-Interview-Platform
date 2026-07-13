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
        "hidden min-h-dvh w-72 shrink-0 border-r border-white/40 bg-slate-950 px-4 py-5 text-white shadow-md lg:flex lg:flex-col",
        className,
      )}
    >
      <div className="px-2 pb-4">
        <AptlyLogo
          wordmarkClassName="text-white"
          markClassName="border-white/15 bg-white text-primary"
        />
      </div>
      <WorkspaceSwitcher
        workspace={workspace}
        className="mb-4 w-full border-white/10 bg-white/10 text-white hover:bg-white/15"
      />
      <nav className="space-y-1.5" aria-label="Primary">
        {navigation.map((item) =>
          item.disabled || item.href === undefined ? (
            <div
              key={item.label}
              aria-disabled="true"
              className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-400 opacity-80"
              title="Not available in this staging build"
            >
              <item.icon className="size-4" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
              <span className="sr-only">Not available in this staging build</span>
            </div>
          ) : (
            <a
              key={item.label}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-200 transition-colors duration-base hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                item.current &&
                  "bg-gradient-to-r from-primary to-indigo-500 text-white shadow-sm shadow-primary/25",
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </a>
          ),
        )}
      </nav>
    </aside>
  );
}

export { Sidebar };
