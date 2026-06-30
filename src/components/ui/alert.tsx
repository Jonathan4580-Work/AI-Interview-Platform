import { cva } from "class-variance-authority";

import { cn } from "@/shared/utils/cn";

import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

const alertVariants = cva("rounded-md border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-info/20 bg-info-soft text-info",
      success: "border-success/20 bg-success-soft text-success",
      warning: "border-warning/25 bg-warning-soft text-warning",
      danger: "border-destructive/20 bg-destructive/10 text-destructive",
      neutral: "border-border bg-surface text-foreground",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

interface AlertProps extends ComponentPropsWithoutRef<"div">, VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return <div className={cn(alertVariants({ variant }), className)} role="status" {...props} />;
}

function AlertTitle({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("font-medium text-current", className)} {...props} />;
}

function AlertDescription({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("mt-1 text-current/85", className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
