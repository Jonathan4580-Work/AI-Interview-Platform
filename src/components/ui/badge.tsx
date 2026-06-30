import { cva } from "class-variance-authority";

import { cn } from "@/shared/utils/cn";

import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium leading-5 tracking-normal",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-slate",
        primary: "border-primary/20 bg-primary-soft text-primary",
        success: "border-success/20 bg-success-soft text-success",
        warning: "border-warning/25 bg-warning-soft text-warning",
        danger: "border-destructive/20 bg-destructive/10 text-destructive",
        info: "border-info/20 bg-info-soft text-info",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

interface BadgeProps extends ComponentPropsWithoutRef<"span">, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
