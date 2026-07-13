"use client";

import { Laptop, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/shared/utils/cn";

const nextTheme = {
  light: "dark",
  dark: "system",
  system: "light",
} as const;

export function ThemeToggle({ className }: { readonly className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const Icon = theme === "system" ? Laptop : resolvedTheme === "dark" ? Moon : Sun;
  const label =
    theme === "system"
      ? "Use light theme"
      : theme === "light"
        ? "Use dark theme"
        : "Use system theme";

  return (
    <Button
      type="button"
      variant="quiet"
      size="icon"
      className={cn(className)}
      aria-label={label}
      title={label}
      onClick={() => {
        setTheme(nextTheme[theme]);
      }}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
