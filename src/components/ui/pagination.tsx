import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";

interface PaginationProps {
  pageLabel: string;
  previousLabel?: string;
  nextLabel?: string;
  canPrevious?: boolean;
  canNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
}

function Pagination({
  pageLabel,
  previousLabel = "Previous page",
  nextLabel = "Next page",
  canPrevious = false,
  canNext = false,
  onPrevious,
  onNext,
  className,
}: PaginationProps) {
  return (
    <nav
      className={cn("flex items-center justify-between gap-3", className)}
      aria-label="Pagination"
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={!canPrevious}
        onClick={onPrevious}
        aria-label={previousLabel}
      >
        <ChevronLeft aria-hidden="true" />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">{pageLabel}</span>
      <Button
        variant="secondary"
        size="sm"
        disabled={!canNext}
        onClick={onNext}
        aria-label={nextLabel}
      >
        Next
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

export { Pagination };
