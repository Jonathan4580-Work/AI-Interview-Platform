import { Menu, Search } from "lucide-react";

import { AccountMenu } from "@/components/layout/account-menu";
import { NotificationButton } from "@/components/layout/notification-button";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { Button } from "@/components/ui/button";

import type { ShellUser, ShellWorkspace } from "@/components/layout/navigation-types";

interface TopNavigationProps {
  user: ShellUser;
  workspace: ShellWorkspace;
  onOpenMobileNavigation: () => void;
}

function TopNavigation({ user, workspace, onOpenMobileNavigation }: TopNavigationProps) {
  return (
    <header className="sticky top-0 z-header flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <Button
        variant="quiet"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNavigation}
        aria-label="Open navigation"
      >
        <Menu aria-hidden="true" />
      </Button>
      <div className="hidden min-w-0 lg:block">
        <WorkspaceSwitcher workspace={workspace} className="h-9 w-64" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex h-9 max-w-md items-center gap-2 rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">
          <Search className="size-4" aria-hidden="true" />
          <span className="truncate">Search workspace</span>
        </div>
      </div>
      <NotificationButton />
      <AccountMenu user={user} />
    </header>
  );
}

export { TopNavigation };
