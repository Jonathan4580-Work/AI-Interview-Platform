import { ChevronRight } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import type { ComponentPropsWithoutRef } from "react";

function Breadcrumb({ className, ...props }: ComponentPropsWithoutRef<"nav">) {
  return <nav aria-label="Breadcrumb" className={cn("text-sm", className)} {...props} />;
}

function BreadcrumbList({ className, ...props }: ComponentPropsWithoutRef<"ol">) {
  return (
    <ol
      className={cn("flex flex-wrap items-center gap-1.5 text-muted-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: ComponentPropsWithoutRef<"li">) {
  return <li className={cn("inline-flex items-center gap-1.5", className)} {...props} />;
}

function BreadcrumbLink({ className, ...props }: ComponentPropsWithoutRef<"a">) {
  return <a className={cn("transition-colors hover:text-foreground", className)} {...props} />;
}

function BreadcrumbPage({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return (
    <span className={cn("font-medium text-foreground", className)} aria-current="page" {...props} />
  );
}

function BreadcrumbSeparator({ className, ...props }: ComponentPropsWithoutRef<"li">) {
  return (
    <li className={cn("text-muted-foreground", className)} aria-hidden="true" {...props}>
      <ChevronRight className="size-3.5" />
    </li>
  );
}

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
