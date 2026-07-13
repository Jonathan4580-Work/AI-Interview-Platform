import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/shared/utils/cn";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function PremiumHero({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-700 p-6 text-white shadow-md sm:p-8",
        className,
      )}
    >
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.28),transparent_18rem)]" />
      <div className="relative z-10 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          {eyebrow === undefined ? null : (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100/80">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">{title}</h1>
          {description === undefined ? null : (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50/80 sm:text-base">
              {description}
            </p>
          )}
        </div>
        {actions === undefined ? null : <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  caption,
  icon,
  tone = "blue",
}: {
  readonly label: string;
  readonly value: string | number;
  readonly caption?: string;
  readonly icon?: ReactNode;
  readonly tone?: "blue" | "green" | "amber" | "violet";
}) {
  const toneClass = {
    blue: "from-blue-500/16 to-indigo-500/8 text-blue-700 dark:text-blue-200",
    green: "from-emerald-500/16 to-teal-500/8 text-emerald-700 dark:text-emerald-200",
    amber: "from-amber-500/18 to-orange-500/8 text-amber-700 dark:text-amber-200",
    violet: "from-violet-500/16 to-blue-500/8 text-violet-700 dark:text-violet-200",
  }[tone];
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative p-5">
        <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", toneClass)} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            {caption === undefined ? null : (
              <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
            )}
          </div>
          {icon === undefined ? null : (
            <span
              className={cn(
                "grid size-10 place-items-center rounded-xl bg-gradient-to-br",
                toneClass,
              )}
            >
              {icon}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description === undefined ? null : (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action === undefined ? null : <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Timeline({
  steps,
  current,
}: {
  readonly steps: readonly string[];
  readonly current: string;
}) {
  const currentIndex = Math.max(0, steps.indexOf(current));
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => {
        const complete = index <= currentIndex;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-2 rounded-xl border p-3 text-sm",
              complete
                ? "border-primary/20 bg-primary-soft text-primary"
                : "border-border bg-muted/20 text-muted-foreground",
            )}
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-medium">{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function AIInsightCard({
  title,
  children,
  className,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-primary/15 bg-gradient-to-br from-primary-soft via-surface to-primary-soft/60 p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles className="size-4" aria-hidden="true" />
        {title}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/70 p-8 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
        <ArrowRight className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-4 font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action === undefined ? null : <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ChipList({ values }: { readonly values: readonly string[] }) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">None recorded.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge key={value} variant="neutral">
          {value}
        </Badge>
      ))}
    </div>
  );
}

export function ProseBlock(props: ComponentPropsWithoutRef<"div">) {
  return (
    <div {...props} className={cn("text-sm leading-6 text-muted-foreground", props.className)} />
  );
}
