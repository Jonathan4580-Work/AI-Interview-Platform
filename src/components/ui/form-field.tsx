import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/shared/utils/cn";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

interface FormFieldProps extends ComponentPropsWithoutRef<"div"> {
  label: string;
  htmlFor: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

function FormField({
  label,
  htmlFor,
  description,
  error,
  required,
  children,
  className,
  ...props
}: FormFieldProps) {
  const descriptionId = description ? `${htmlFor}-description` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("grid gap-1.5", className)} {...props}>
      <LabelPrimitive.Root htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </LabelPrimitive.Root>
      {children}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { FormField };
