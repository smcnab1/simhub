"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { type ReactNode, useMemo } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

export function Providers({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const convex = useMemo(
    () => (convexUrl ? new ConvexReactClient(convexUrl) : null),
    [convexUrl],
  );

  const content = convex ? (
    <ConvexProvider client={convex}>
      {children}
      <Toaster />
      <Analytics />
      <SpeedInsights/>
    </ConvexProvider>
  ) : (
    <>
      {children}
      <Toaster />
      <Analytics />
      <SpeedInsights/>
    </>
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      disableTransitionOnChange
    >
      {content}
    </ThemeProvider>
  );
}
