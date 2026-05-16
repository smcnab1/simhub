"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getAdminNavigationItems } from "@/lib/navigation";

const adminNavItems = getAdminNavigationItems();

export function AdminNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin navigation"
      className={cn("flex flex-col gap-6", className)}
    >
      <div className="flex flex-col gap-1">
        {adminNavItems.map((item) => {
          const isActive =
            pathname === item.url ||
            (item.url !== "/dashboard/admin/facility" &&
              pathname.startsWith(item.url));
          const Icon = item.icon;

          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "shrink-0",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-accent-foreground"
                )}
              >
                {Icon ? <Icon className="size-4" /> : null}
              </span>
              <span className="flex-1 truncate">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Compact horizontal pill navigation for mobile */
export function AdminNavPills({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin navigation"
      className={cn(
        "flex gap-1.5 overflow-x-auto border-b border-border pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {adminNavItems.map((item) => {
        const isActive =
          pathname === item.url ||
          (item.url !== "/dashboard/admin/facility" &&
            pathname.startsWith(item.url));
        const Icon = item.icon;

        return (
          <Link
            key={item.url}
            href={item.url}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {Icon ? <Icon className="size-4" /> : null}
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
