"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { ContentContainer } from "@/components/layout/content-container";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNavigation } from "@/components/layout/top-navigation";
import { createWorkspaceNavigation } from "@/components/layout/workspace-navigation";

import type {
  ShellNavigationItem,
  ShellUser,
  ShellWorkspace,
} from "@/components/layout/navigation-types";
import type { PermissionKey } from "@/modules/access-control";
import type { ShellAudience } from "@/components/layout/workspace-navigation";
import type { ReactNode } from "react";

const defaultNavigation: readonly ShellNavigationItem[] = createWorkspaceNavigation("/dashboard");

const defaultUser: ShellUser = {
  name: "Account",
  email: "",
  initials: "A",
  roleLabel: "Signed in",
};

const defaultWorkspace: ShellWorkspace = {
  name: "Workspace",
  planLabel: "Signed in",
};

interface AppShellProps {
  children: ReactNode;
  navigation?: readonly ShellNavigationItem[];
  user?: ShellUser;
  workspace?: ShellWorkspace;
  audience?: ShellAudience;
  permissions?: readonly PermissionKey[];
  onSignOut?: () => void | Promise<void>;
}

function AppShell({
  children,
  navigation,
  user = defaultUser,
  workspace = defaultWorkspace,
  audience = "company",
  permissions,
  onSignOut,
}: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const pathname = usePathname();
  const permissionSet = permissions === undefined ? undefined : new Set(permissions);
  const resolvedNavigation =
    navigation ?? createWorkspaceNavigation(pathname, audience, permissionSet);

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
