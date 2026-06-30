import { AptlyLogo } from "@/components/brand/logo";
import { cn } from "@/shared/utils/cn";

import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}

function AuthShell({ title, description, children, aside, className }: AuthShellProps) {
  return (
    <main className="min-h-dvh bg-canvas text-foreground">
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6">
          <div className={cn("w-full max-w-sm", className)}>
            <AptlyLogo className="mb-10" />
            <div className="mb-6 space-y-2">
              <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
              {description ? (
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {children}
          </div>
        </section>
        <aside className="hidden border-l border-border bg-surface px-8 py-10 lg:flex lg:flex-col lg:justify-between">
          {aside ?? (
            <>
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Enterprise recruiting operations
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Structured interview infrastructure with clear permissions, auditability, and calm
                  workflows.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Aptly keeps candidate decisions human-owned.
              </p>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

export { AuthShell };
