import { cn } from "@/shared/utils/cn";

interface AptlyLogoProps {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
}

export function AptlyLogo({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
}: AptlyLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <AptlyMark className={markClassName} />
      {showWordmark ? (
        <span
          className={cn(
            "text-[15px] font-semibold leading-none tracking-normal text-ink dark:text-foreground",
            wordmarkClassName,
          )}
        >
          Aptly
        </span>
      ) : (
        <span className="sr-only">Aptly</span>
      )}
    </span>
  );
}

export function AptlyMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-7 place-items-center rounded-md border border-border bg-surface text-primary shadow-xs dark:bg-surface",
        className,
      )}
    >
      <span className="absolute left-[7px] top-[6px] h-[15px] w-[2px] -rotate-[18deg] rounded-full bg-current" />
      <span className="absolute left-[13px] top-[7px] h-[14px] w-[2px] rotate-[22deg] rounded-full bg-current" />
      <span className="absolute bottom-[7px] right-[6px] h-[2px] w-[9px] rounded-full bg-current" />
    </span>
  );
}
