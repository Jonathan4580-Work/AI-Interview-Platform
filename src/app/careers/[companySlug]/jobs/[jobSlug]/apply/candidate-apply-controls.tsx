"use client";

import { useState } from "react";

import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { Input } from "@/components/ui/input";

import type { ReactNode } from "react";

export function CandidateAuthSubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  readonly children: ReactNode;
  readonly pendingLabel: string;
  readonly variant?: "primary" | "secondary";
}) {
  return (
    <PendingSubmitButton pendingLabel={pendingLabel} variant={variant}>
      {children}
    </PendingSubmitButton>
  );
}

export function CandidateCvInput() {
  const [fileLabel, setFileLabel] = useState("No CV selected.");

  return (
    <div className="grid gap-2">
      <Input
        name="cv"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        required
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          if (file === null) {
            setFileLabel("No CV selected.");
            return;
          }
          setFileLabel(`${file.name} selected · ${formatBytes(file.size)}`);
        }}
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {fileLabel}
      </p>
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${String(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
