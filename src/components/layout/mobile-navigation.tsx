"use client";

import { AptlyLogo } from "@/components/brand/logo";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/shared/utils/cn";

import type { ShellNavigationItem, ShellWorkspace } from "@/components/layout/navigation-types";

interface MobileNavigationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigation: readonly ShellNavigationItem[];
  workspace: ShellWorkspace;
}

function MobileNavigation({ open, onOpenChange, navigation, workspace }: MobileNavigationProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle className="sr-only">Navigation</DrawerTitle>
          <AptlyLogo />
        </DrawerHeader>
        <div className="p-4">
          <WorkspaceSwitcher workspace={workspace} className="mb-4 w-full" />
          <nav className="space-y-1" aria-label="Mobile primary">
            {navigation.map((item) => (
              <a
                key={item.label}
                href={item.href ?? "#"}
                aria-current={item.current ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  item.current && "bg-primary-soft text-primary",
                  item.disabled && "pointer-events-none opacity-50",
                )}
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export { MobileNavigation };
