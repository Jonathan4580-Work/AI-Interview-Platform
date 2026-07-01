"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { shellAudienceStorageKey } from "@/components/layout/workspace-navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ShellUser } from "@/components/layout/navigation-types";

interface AccountMenuProps {
  user: ShellUser;
  onSignOut?: () => void | Promise<void>;
}

function AccountMenu({ user, onSignOut = signOut }: AccountMenuProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="icon" aria-label="Open account menu">
          <Avatar className="size-7">
            <AvatarFallback>{user.initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        className="w-[min(20rem,calc(100vw-2rem))]"
      >
        <DropdownMenuLabel className="space-y-1.5">
          <span className="block truncate text-sm text-foreground" title={user.name}>
            {user.name}
          </span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {user.roleLabel}
          </span>
          {user.email.length > 0 ? (
            <span
              className="block truncate text-xs font-normal text-muted-foreground"
              title={user.email}
            >
              {user.email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSigningOut}
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut aria-hidden="true" />
          {isSigningOut ? "Signing out" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

async function signOut(): Promise<void> {
  const csrfToken = readAuthCsrfToken();
  const headers = new Headers();
  if (csrfToken !== null) {
    headers.set("x-csrf-token", csrfToken);
  }

  const response = await fetch("/api/internal/v1/auth/logout", {
    method: "POST",
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    return;
  }

  window.sessionStorage.removeItem(shellAudienceStorageKey);
  window.location.assign("/login");
}

function readAuthCsrfToken(): string | null {
  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("__Host-aptly_csrf=") || part.startsWith("aptly_csrf="))
      ?.split("=")
      .slice(1)
      .join("=") ?? null
  );
}

export { AccountMenu };
