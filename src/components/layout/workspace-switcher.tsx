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
        <Button variant="secondary" className={cn("h-10 justify-start gap-3 px-2.5", className)}>
          <span className="grid size-6 place-items-center rounded-sm bg-primary-soft text-xs font-semibold text-primary">
            {workspace.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium text-foreground">
              {workspace.name}
            </span>
            {workspace.planLabel ? (
              <span className="block truncate text-xs text-muted-foreground">
                {workspace.planLabel}
              </span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuItem>{workspace.name}</DropdownMenuItem>
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
