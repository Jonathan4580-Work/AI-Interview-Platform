"use client";

import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";

import type { ShellWorkspace } from "@/components/layout/navigation-types";

interface WorkspaceSwitcherProps {
  workspace: ShellWorkspace;
  workspaces?: readonly ShellWorkspace[];
  className?: string;
}

function WorkspaceSwitcher({ workspace, workspaces = [], className }: WorkspaceSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className={cn(
            "min-h-14 justify-start gap-3 rounded-xl border-white/10 bg-white/10 px-3 py-2.5 text-left leading-tight text-white shadow-none hover:bg-white/15",
            className,
          )}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-xs font-bold text-primary shadow-sm">
            {workspace.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
            <span className="block truncate text-sm font-semibold leading-5 text-current">
              {workspace.name}
            </span>
            {workspace.planLabel ? (
              <span className="block truncate text-xs leading-4 text-current/70">
                {workspace.planLabel}
              </span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-current/60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={16}
        className="w-[min(20rem,calc(100vw-2rem))]"
      >
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuItem className="min-w-0">
          <span className="truncate" title={workspace.name}>
            {workspace.name}
          </span>
        </DropdownMenuItem>
        {workspaces.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {workspaces.map((item) => (
              <DropdownMenuItem key={item.name}>{item.name}</DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { WorkspaceSwitcher };
