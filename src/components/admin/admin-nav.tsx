"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2Icon,
  MapPinIcon,
  LayoutGridIcon,
  DoorOpenIcon,
  ClipboardListIcon,
  UsersIcon,
  SettingsIcon,
  ChevronRightIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const adminNavGroups: NavGroup[] = [
  {
    label: "Organisation",
    items: [
      {
        label: "Facility Details",
        href: "/dashboard/admin/facility",
        icon: <Building2Icon className="size-4" />,
      },
      {
        label: "Campuses",
        href: "/dashboard/admin/campuses",
        icon: <MapPinIcon className="size-4" />,
      },
    ],
  },
  {
    label: "Resources",
    items: [
      {
        label: "Room Types",
        href: "/dashboard/admin/room-types",
        icon: <LayoutGridIcon className="size-4" />,
      },
      {
        label: "Rooms",
        href: "/dashboard/admin/rooms",
        icon: <DoorOpenIcon className="size-4" />,
      },
    ],
  },
  {
    label: "Forms & Workflows",
    items: [
      {
        label: "Request Form",
        href: "/dashboard/admin/forms",
        icon: <ClipboardListIcon className="size-4" />,
      },
    ],
  },
  {
    label: "Users & Access",
    items: [
      {
        label: "Accounts",
        href: "/dashboard/admin/accounts",
        icon: <UsersIcon className="size-4" />,
      },
    ],
  },
];

export function AdminNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin navigation"
      className={cn("flex flex-col gap-6", className)}
    >
      {adminNavGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-0.5">
            {group.label}
          </p>
          {group.items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard/admin/facility" &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
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
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Compact horizontal pill navigation for mobile */
export function AdminNavPills({ className }: { className?: string }) {
  const pathname = usePathname();
  const allItems = adminNavGroups.flatMap((g) => g.items);

  return (
    <nav
      aria-label="Admin navigation"
      className={cn(
        "flex flex-wrap gap-1.5 pb-4 border-b border-border",
        className
      )}
    >
      {allItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard/admin/facility" &&
            pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
