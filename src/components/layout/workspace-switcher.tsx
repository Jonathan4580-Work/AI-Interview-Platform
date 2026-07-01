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
            "min-h-12 justify-start gap-3 px-2.5 py-2 text-left leading-tight",
            className,
          )}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-primary-soft text-xs font-semibold text-primary">
            {workspace.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
            <span className="block truncate text-sm font-medium leading-5 text-foreground">
              {workspace.name}
            </span>
            {workspace.planLabel ? (
              <span className="block truncate text-xs leading-4 text-muted-foreground">
                {workspace.planLabel}
              </span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
