import { AppShell } from "@/components/layout/app-shell";
import { authCookieNames } from "@/server/api";
import { getWorkspaceShellContext } from "@/server/auth/shell-context";

import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(authCookieNames.session)?.value;

  if (sessionToken === undefined) {
    redirect("/login");
  }

  const shell = await getWorkspaceShellContext(sessionToken);
  if (shell === null) {
    redirect("/login");
  }

  return (
    <AppShell
      audience={shell.audience}
      permissions={shell.permissions}
      user={shell.user}
      workspace={shell.workspace}
    >
      {children}
    </AppShell>
  );
}
