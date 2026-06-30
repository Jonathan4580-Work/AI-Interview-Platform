import { cn } from "@/shared/utils/cn";

import type { ComponentPropsWithoutRef } from "react";

function ContentContainer({ className, ...props }: ComponentPropsWithoutRef<"main">) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8",
        className,
      )}
      {...props}
    />
  );
}

export { ContentContainer };
