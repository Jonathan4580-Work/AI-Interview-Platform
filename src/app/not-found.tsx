import { AptlyLogo } from "@/components/brand/logo";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas p-6">
      <AptlyLogo />
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          title="Page not found"
          description="The page could not be found or is no longer available."
        />
      </div>
    </div>
  );
}
