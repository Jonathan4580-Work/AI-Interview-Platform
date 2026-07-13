import { Menu, Search } from "lucide-react";

import { AccountMenu } from "@/components/layout/account-menu";
import { NotificationButton } from "@/components/layout/notification-button";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ShellUser, ShellWorkspace } from "@/components/layout/navigation-types";

interface TopNavigationProps {
  user: ShellUser;
  workspace: ShellWorkspace;
  onSignOut?: () => void | Promise<void>;
  onOpenMobileNavigation: () => void;
}

function TopNavigation({ user, workspace, onSignOut, onOpenMobileNavigation }: TopNavigationProps) {
  return (
    <header className="sticky top-0 z-header flex min-h-16 items-center gap-3 border-b border-border/70 bg-surface/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
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
        <WorkspaceSwitcher
          workspace={workspace}
          className="w-72 border-border/80 bg-surface text-foreground hover:bg-muted"
        />
      </div>
      <div className="min-w-0 flex-1">
        <form
          role="search"
          action="/search"
          className="flex h-11 max-w-xl items-center gap-2 rounded-xl border border-border/80 bg-muted/70 px-3 text-sm text-muted-foreground shadow-xs focus-within:bg-surface focus-within:ring-2 focus-within:ring-ring/30"
        >
          <label className="sr-only" htmlFor="global-workspace-search">
            Search workspace
          </label>
          <Search className="size-4" aria-hidden="true" />
          <Input
            id="global-workspace-search"
            name="query"
            className="h-7 min-w-0 border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Search workspace"
          />
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
      </div>
      <ThemeToggle />
      <NotificationButton />
      <AccountMenu user={user} onSignOut={onSignOut} />
    </header>
  );
}

export { TopNavigation };
