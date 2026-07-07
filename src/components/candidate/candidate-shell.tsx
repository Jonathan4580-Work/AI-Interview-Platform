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
  readonly currentStep?:
    "welcome" | "consent" | "identity" | "readiness" | "interview" | "complete";
}

export function CandidateShell({
  eyebrow = "Candidate interview",
  title,
  description,
  children,
  actions,
  currentStep = "welcome",
}: CandidateShellProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)))] text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <AptlyLogo />
          <Button asChild variant="quiet" size="sm">
            <Link href="/candidate/support">Support</Link>
          </Button>
        </header>
        <CandidateJourneyStepper currentStep={currentStep} />
        <div className="grid flex-1 place-items-center py-10">
          <Card className="w-full max-w-3xl shadow-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {eyebrow}
              </p>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {children}
              {actions ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

const candidateSteps = [
  ["welcome", "Welcome"],
  ["consent", "Consent"],
  ["identity", "Identity"],
  ["readiness", "Readiness"],
  ["interview", "Interview"],
  ["complete", "Complete"],
] as const;

function CandidateJourneyStepper({
  currentStep,
}: {
  readonly currentStep: CandidateShellProps["currentStep"];
}) {
  const currentIndex = candidateSteps.findIndex(([key]) => key === currentStep);

  return (
    <nav aria-label="Interview setup progress" className="pt-5">
      <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {candidateSteps.map(([key, label], index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li
              key={key}
              className={`rounded-md border px-3 py-2 text-sm ${
                active
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : complete
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-border bg-card text-muted-foreground"
              }`}
            >
              <span className="block truncate">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
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
