import { AdminNav } from "@/components/admin/admin-nav";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AdminShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Two-column admin layout:
 * - Left: sticky sidebar nav (hidden on mobile, shown on lg+)
 * - Right: main content area
 *
 * On mobile, the per-page AdminNavPills component handles navigation.
 */
export function AdminShell({ children, className }: AdminShellProps) {
  return (
    <div className={cn("flex w-full gap-8", className)}>
      {/* Sidebar – hidden below lg */}
      <aside
        aria-label="Admin sidebar"
        className="hidden lg:flex flex-col w-52 xl:w-56 shrink-0"
      >
        <div className="sticky top-[4.5rem] flex flex-col gap-2">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1">
            Administration
          </p>
          <AdminNav />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col gap-6">{children}</main>
    </div>
  );
}
