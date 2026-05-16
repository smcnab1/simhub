import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  BellIcon,
  BlocksIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  Code2Icon,
  DatabaseZapIcon,
  FlagIcon,
  GaugeIcon,
  HeartPulseIcon,
  InfoIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MapPinIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TerminalIcon,
  TestTube2Icon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";
import { canAccessAdmin, canAccessDeveloper, canAccessStaff } from "@/lib/authz-logic";
import type { Role } from "@/lib/domain";

export type NavEnvironment = "development" | "preview" | "production" | "test" | "local";

export type NavigationItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  roles?: Role[];
  items?: NavigationItem[];
  featureFlag?: string;
  environments?: NavEnvironment[];
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
  roles?: Role[];
};

type NavigationContext = {
  role?: Role;
  featureFlags?: Record<string, boolean>;
  environment?: string;
};

const adminItems: NavigationItem[] = [
  { title: "Facility", url: "/dashboard/admin/facility", icon: Settings2Icon },
  { title: "Campuses", url: "/dashboard/admin/campuses", icon: MapPinIcon },
  { title: "Room Types", url: "/dashboard/admin/room-types", icon: BlocksIcon },
  { title: "Rooms", url: "/dashboard/admin/rooms", icon: LayoutDashboardIcon },
  { title: "Request Form", url: "/dashboard/admin/forms", icon: ClipboardListIcon },
  { title: "Accounts", url: "/dashboard/admin/accounts", icon: UsersIcon },
];

const developerItems: NavigationItem[] = [
  { title: "Developer Dashboard", url: "/dashboard/developer", icon: GaugeIcon },
  { title: "Tenant Management", url: "/dashboard/developer/tenants", icon: ShieldCheckIcon },
  { title: "Seed/Bootstrap Tools", url: "/dashboard/developer/bootstrap", icon: SparklesIcon },
  { title: "System Settings", url: "/dashboard/developer/system-settings", icon: SlidersHorizontalIcon },
  { title: "Feature Flags", url: "/dashboard/developer/feature-flags", icon: FlagIcon },
  { title: "User Impersonation/Login-As", url: "/dashboard/developer/impersonation", icon: UserCogIcon },
  { title: "Audit Logs", url: "/dashboard/developer/audit-logs", icon: ListChecksIcon },
  { title: "Queue/Jobs Monitor", url: "/dashboard/developer/jobs", icon: ActivityIcon },
  { title: "Convex Debug Tools", url: "/dashboard/developer/convex-debug", icon: DatabaseZapIcon },
  { title: "Environment Info", url: "/dashboard/developer/environment", icon: InfoIcon },
  { title: "System Health", url: "/dashboard/developer/health", icon: HeartPulseIcon },
  { title: "Dev Utilities", url: "/dashboard/developer/utilities", icon: TerminalIcon },
  { title: "API/Test Tools", url: "/dashboard/developer/api-tools", icon: TestTube2Icon },
];

/**
 * Central navigation registry. Add new sidebar or platform tools here with
 * role, feature flag, or environment metadata instead of branching in UI code.
 */
export const dashboardNavigation: NavigationGroup[] = [
  {
    title: "User",
    roles: ["Developer", "Admin", "Staff", "Requester"],
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
      { title: "Notifications", url: "/dashboard/notifications", icon: BellIcon },
    ],
  },
  {
    title: "Manager",
    roles: ["Developer", "Admin", "Staff"],
    items: [
      { title: "Requests", url: "/dashboard/requests", icon: ClipboardListIcon },
      { title: "Calendar", url: "/dashboard/resource-calendar", icon: CalendarDaysIcon },
      { title: "Audit Log", url: "/dashboard/audit-logs", icon: ListChecksIcon },
    ],
  },
  {
    title: "Admin",
    roles: ["Developer", "Admin"],
    items: [
      {
        title: "Admin",
        url: "/dashboard/admin/facility",
        icon: Settings2Icon,
        roles: ["Developer", "Admin"],
        items: adminItems,
      },
    ],
  },
  {
    title: "Developer",
    roles: ["Developer"],
    items: [
      {
        title: "Developer Tools",
        url: "/dashboard/developer",
        icon: Code2Icon,
        roles: ["Developer"],
        items: developerItems,
      },
    ],
  },
];

function normalizedEnvironment(environment?: string) {
  return environment?.trim().toLowerCase();
}

function canRoleSeeItem(role: Role | undefined, itemRoles?: Role[]) {
  if (!itemRoles?.length) return true;
  if (!role) return false;

  return itemRoles.some((itemRole) => {
    if (itemRole === "Developer") return canAccessDeveloper(role);
    if (itemRole === "Admin") return canAccessAdmin(role);
    if (itemRole === "Staff") return canAccessStaff(role);
    return role === itemRole;
  });
}

function isVisibleInContext(item: NavigationItem, context: NavigationContext) {
  if (!canRoleSeeItem(context.role, item.roles)) return false;

  if (item.featureFlag && !context.featureFlags?.[item.featureFlag]) {
    return false;
  }

  if (item.environments?.length) {
    const environment = normalizedEnvironment(context.environment);
    if (!environment || !item.environments.includes(environment as NavEnvironment)) {
      return false;
    }
  }

  return true;
}

function filterItem(
  item: NavigationItem,
  context: NavigationContext
): NavigationItem | null {
  if (!isVisibleInContext(item, context)) return null;

  const items = item.items
    ?.map((child) => filterItem(child, context))
    .filter((child): child is NavigationItem => child !== null);

  return { ...item, items };
}

export function getDashboardNavigation(context: NavigationContext) {
  return dashboardNavigation
    .filter((group) => canRoleSeeItem(context.role, group.roles))
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => filterItem(item, context))
        .filter((item): item is NavigationItem => item !== null),
    }))
    .filter((group) => group.items.length > 0);
}

export function getAdminNavigationItems() {
  return adminItems;
}

export function getDeveloperNavigationItems() {
  return developerItems;
}
