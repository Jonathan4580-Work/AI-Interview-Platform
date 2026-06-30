"use client";

import { AptlyLogo } from "@/components/brand/logo";
import { ErrorState } from "@/components/ui/error-state";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas p-6">
      <AptlyLogo />
      <div className="flex flex-1 items-center justify-center">
        <ErrorState
          title="Something went wrong"
          description="Refresh the page or return to the previous screen."
          actionLabel="Try again"
          onAction={reset}
        />
      </div>
    </div>
  );
}
