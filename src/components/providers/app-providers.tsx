"use client";

import { ThemeProvider } from "@/components/theme/theme-provider";

import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
