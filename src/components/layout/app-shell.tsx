"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { ContentContainer } from "@/components/layout/content-container";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNavigation } from "@/components/layout/top-navigation";
import {
  createWorkspaceNavigation,
  shellAudienceStorageKey,
} from "@/components/layout/workspace-navigation";

import type {
  ShellNavigationItem,
  ShellUser,
  ShellWorkspace,
} from "@/components/layout/navigation-types";
import type { ShellAudience } from "@/components/layout/workspace-navigation";
import type { ReactNode } from "react";

const defaultNavigation: readonly ShellNavigationItem[] = createWorkspaceNavigation("/");

const defaultUser: ShellUser = {
  name: "Workspace User",
  email: "user@example.com",
  initials: "WU",
};

const defaultWorkspace: ShellWorkspace = {
  name: "Workspace",
  planLabel: "Company workspace",
};

interface AppShellProps {
  children: ReactNode;
  navigation?: readonly ShellNavigationItem[];
  user?: ShellUser;
  workspace?: ShellWorkspace;
  onSignOut?: () => void | Promise<void>;
}

function AppShell({
  children,
  navigation,
  user = defaultUser,
  workspace = defaultWorkspace,
  onSignOut,
}: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [audience] = useState<ShellAudience>(readShellAudience);
  const pathname = usePathname();
  const resolvedNavigation = navigation ?? createWorkspaceNavigation(pathname, audience);

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <div className="flex min-h-dvh">
        <Sidebar navigation={resolvedNavigation} workspace={workspace} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNavigation
            user={user}
            workspace={workspace}
            onSignOut={onSignOut}
            onOpenMobileNavigation={() => {
              setMobileNavigationOpen(true);
            }}
          />
          <ContentContainer>{children}</ContentContainer>
        </div>
      </div>
      <MobileNavigation
        open={mobileNavigationOpen}
        onOpenChange={setMobileNavigationOpen}
        navigation={resolvedNavigation}
        workspace={workspace}
      />
    </div>
  );
}

export { AppShell, defaultNavigation };

function readShellAudience(): ShellAudience {
  if (typeof window === "undefined") {
    return "company";
  }

  return window.sessionStorage.getItem(shellAudienceStorageKey) === "platform"
    ? "platform"
    : "company";
}
