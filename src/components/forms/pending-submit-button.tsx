"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import type { ButtonProps } from "@/components/ui/button";

interface PendingSubmitButtonProps extends Omit<ButtonProps, "type"> {
  readonly pendingLabel: string;
}

export function PendingSubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: PendingSubmitButtonProps) {
  const status = useFormStatus();
  const isPending = status.pending;

  return (
    <Button
      type="submit"
      disabled={disabled === true || isPending}
      aria-busy={isPending}
      {...props}
    >
      {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {isPending ? pendingLabel : children}
    </Button>
  );
}
