import { Loader2 } from "lucide-react";

import { cn } from "@/shared/utils/cn";

interface LoadingStateProps {
  label?: string;
  className?: string;
}

function LoadingState({ label = "Loading", className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export { LoadingState };
