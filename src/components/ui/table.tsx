import { cn } from "@/shared/utils/cn";

import type { ComponentPropsWithoutRef } from "react";

function Table({ className, ...props }: ComponentPropsWithoutRef<"table">) {
  return <table className={cn("w-full caption-bottom text-sm", className)} {...props} />;
}

function TableHeader({ className, ...props }: ComponentPropsWithoutRef<"thead">) {
  return <thead className={cn("border-b border-border bg-muted/60", className)} {...props} />;
}

function TableBody({ className, ...props }: ComponentPropsWithoutRef<"tbody">) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

function TableRow({ className, ...props }: ComponentPropsWithoutRef<"tr">) {
  return <tr className={cn("transition-colors hover:bg-muted/50", className)} {...props} />;
}

function TableHead({ className, ...props }: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-normal text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return <td className={cn("px-3 py-3 align-middle text-foreground", className)} {...props} />;
}

function TableCaption({ className, ...props }: ComponentPropsWithoutRef<"caption">) {
  return <caption className={cn("mt-3 text-sm text-muted-foreground", className)} {...props} />;
}

export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow };
