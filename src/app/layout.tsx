import "@/styles/globals.css";

import { AppProviders } from "@/components/providers/app-providers";
import { ThemeScript } from "@/components/theme/theme-script";
import { brand } from "@/lib/design-tokens";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: brand.productName,
    template: `%s | ${brand.productName}`,
  },
  description: brand.positioning,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
