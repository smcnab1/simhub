"use client";

import { ShieldCheckIcon } from "lucide-react";
import { PlatformDevSidebar } from "@/components/platform/platform-dev-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { APP_NAME } from "@/lib/config";
import type { PlatformDeveloperAuth } from "@/lib/platform-auth";

export function PlatformDevShell({
  children,
  auth,
}: {
  children: React.ReactNode;
  auth?: PlatformDeveloperAuth;
}) {
  return (
    <SidebarProvider>
      <PlatformDevSidebar auth={auth} />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-amber-500/20 bg-card/90 px-4 py-3 backdrop-blur-xl lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {APP_NAME}
              </p>
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  Developer tools
                </p>
                <span className="inline-flex items-center gap-1 rounded-sm border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                  <ShieldCheckIcon className="size-3" aria-hidden="true" />
                  Platform
                </span>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
