import { cn } from "@/shared/utils/cn";

import type { ComponentPropsWithoutRef } from "react";

function Input({ className, type = "text", ...props }: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-xs transition-colors duration-base placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      type={type}
      {...props}
    />
  );
}

export { Input };
