import Link from "next/link";

import { AptlyLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { ReactNode } from "react";

interface CandidateShellProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}

export function CandidateShell({
  eyebrow = "Candidate interview",
  title,
  description,
  children,
  actions,
}: CandidateShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-border pb-4">
          <AptlyLogo />
          <Button asChild variant="quiet" size="sm">
            <Link href="/candidate/support">Support</Link>
          </Button>
        </header>
        <div className="grid flex-1 place-items-center py-10">
          <Card className="w-full max-w-3xl">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {eyebrow}
              </p>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {children}
              {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

interface CandidateStepLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly variant?: "primary" | "secondary" | "outline" | "quiet" | "destructive";
}

export function CandidateStepLink({ href, children, variant = "primary" }: CandidateStepLinkProps) {
  return (
    <Button asChild variant={variant}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
