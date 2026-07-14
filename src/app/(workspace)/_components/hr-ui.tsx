import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
      {hint === undefined ? null : (
        <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

export function TextField(props: ComponentPropsWithoutRef<typeof Input>) {
  return <Input {...props} />;
}

export function LongTextField(props: ComponentPropsWithoutRef<typeof Textarea>) {
  return <Textarea {...props} />;
}

export function NativeSelect(props: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      {...props}
      className="flex h-9 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-xs transition-colors duration-base focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
    />
  );
}

export function StatusBadge({ value }: { readonly value: string | null | undefined }) {
  const normalized = normalizeLabel(value ?? "unknown");
  const normalizedForTone = normalized.toLowerCase();
  const variant =
    normalizedForTone.includes("failed") ||
    normalizedForTone.includes("cancelled") ||
    normalizedForTone.includes("rejected") ||
    normalizedForTone.includes("expired") ||
    normalizedForTone.includes("not selected") ||
    normalizedForTone.includes("not recommended")
      ? "danger"
      : normalizedForTone.includes("ready") ||
          normalizedForTone.includes("open") ||
          normalizedForTone.includes("sent") ||
          normalizedForTone.includes("completed") ||
          normalizedForTone.includes("active") ||
          normalizedForTone.includes("recommended") ||
          normalizedForTone.includes("confirmed") ||
          normalizedForTone.includes("hired")
        ? "success"
        : normalizedForTone.includes("pending") ||
            normalizedForTone.includes("draft") ||
            normalizedForTone.includes("recovery") ||
            normalizedForTone.includes("interrupted") ||
            normalizedForTone.includes("review") ||
            normalizedForTone.includes("requested")
          ? "warning"
          : "neutral";
  return <Badge variant={variant}>{normalized}</Badge>;
}

export function EmptyPanel({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{description}</p>
    </div>
  );
}

export function formatDate(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.APP_TIMEZONE ?? "Asia/Colombo",
    timeZoneName: "shortOffset",
  }).format(new Date(value));
}

export function titleCase(value: string): string {
  return normalizeLabel(value);
}

export function normalizeLabel(value: string | null | undefined): string {
  const cleaned = (value ?? "unknown")
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/[.:_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();

  if (cleaned.length === 0) return "Unknown";

  return cleaned
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      if (["AI", "CV", "HR", "JD", "PDF", "DOCX", "SMTP", "URL"].includes(upper)) return upper;
      return `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}
