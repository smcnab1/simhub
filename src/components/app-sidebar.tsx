"use client"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import type { DashboardAuth } from "@/components/dashboard-auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { switchTenant } from "@/lib/tenant-actions"
import {
  BellIcon,
  Building2Icon,
  CalendarDaysIcon,
  ChevronsUpDownIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  Settings2Icon,
  ShieldCheckIcon,
} from "lucide-react"

export function AppSidebar({
  auth,
  ...props
}: React.ComponentProps<typeof Sidebar> & { auth: DashboardAuth }) {
  const memberships =
    auth.memberships?.length
      ? auth.memberships
      : [
          {
            tenantName: auth.tenantName ?? auth.tenantSlug,
            tenantSlug: auth.tenantSlug,
            role: auth.role ?? "Staff",
          },
        ]
  const navMain = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Requests",
      url: "/dashboard/requests",
      icon: <ClipboardListIcon />,
    },
    {
      title: "Calendar",
      url: "/dashboard/resource-calendar",
      icon: <CalendarDaysIcon />,
    },
    {
      title: "Notifications",
      url: "/dashboard/notifications",
      icon: <BellIcon />,
    },
    ...(auth.role === "Admin"
      ? [
          {
            title: "Admin",
            url: "/dashboard/admin/facility",
            icon: <Settings2Icon />,
            items: [
              { title: "Facility", url: "/dashboard/admin/facility" },
              { title: "Campuses", url: "/dashboard/admin/campuses" },
              { title: "Room Types", url: "/dashboard/admin/room-types" },
              { title: "Rooms", url: "/dashboard/admin/rooms" },
              { title: "Request Form", url: "/dashboard/admin/forms" },
              { title: "Accounts", url: "/dashboard/admin/accounts" },
            ],
          },
        ]
      : []),
  ]

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  />
                }
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Building2Icon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {auth.tenantName ?? auth.tenantSlug}
                  </span>
                  <span className="truncate text-xs">{auth.role}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 rounded-lg"
                align="start"
                side="right"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Tenant workspace
                </DropdownMenuLabel>
                {memberships.map((membership) => (
                  <form key={membership.tenantSlug} action={switchTenant}>
                    <input
                      type="hidden"
                      name="tenantSlug"
                      value={membership.tenantSlug}
                    />
                    <button className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="flex size-6 items-center justify-center rounded-sm border">
                        <ShieldCheckIcon className="size-3.5" />
                      </span>
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate">{membership.tenantName}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {membership.role}
                        </span>
                      </span>
                    </button>
                  </form>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary
          items={[
            {
              title: "Help desk",
              url: "mailto:simulation@example.edu",
              icon: <LifeBuoyIcon />,
            },
          ]}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: auth.email ?? "Signed in",
            email: auth.role ?? "Member",
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
