"use client";

import {
  Briefcase,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Settings,
  UsersRound,
} from "lucide-react";
import { useState } from "react";

import { ContentContainer } from "@/components/layout/content-container";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNavigation } from "@/components/layout/top-navigation";

import type {
  ShellNavigationItem,
  ShellUser,
  ShellWorkspace,
} from "@/components/layout/navigation-types";
import type { ReactNode } from "react";

const defaultNavigation: readonly ShellNavigationItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, current: true, disabled: true },
  { label: "Roles", icon: Briefcase, disabled: true },
  { label: "Candidates", icon: UsersRound, disabled: true },
  { label: "Interviews", icon: ClipboardList, disabled: true },
  { label: "Reports", icon: FileText, disabled: true },
  { label: "Settings", icon: Settings, disabled: true },
];

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
}

function AppShell({
  children,
  navigation = defaultNavigation,
  user = defaultUser,
  workspace = defaultWorkspace,
}: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <div className="flex min-h-dvh">
        <Sidebar navigation={navigation} workspace={workspace} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNavigation
            user={user}
            workspace={workspace}
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
        navigation={navigation}
        workspace={workspace}
      />
    </div>
  );
}

export { AppShell, defaultNavigation };
