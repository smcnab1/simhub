"use client"

import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import type { DashboardAuth } from "@/components/dashboard-auth"
import { getDashboardNavigation } from "@/lib/navigation"
import Image from "next/image";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { displayNameFromUser } from "@/lib/user-display"
import {
  ChevronsUpDownIcon,
  ShieldCheckIcon,
} from "lucide-react"

export function AppSidebar({
  auth,
  environment,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  auth: DashboardAuth
  environment?: string
}) {
  const memberships =
    auth.memberships?.length
      ? auth.memberships
      : [
          {
            tenantName: auth.tenantName ?? auth.tenantSlug,
            tenantSlug: auth.tenantSlug,
            logoUrl: auth.logoUrl,
            role: auth.role ?? "Staff",
          },
        ]
  const tenant = memberships.find(
    (membership) => membership.tenantSlug === auth.tenantSlug
  )
  const tenantLogo = tenant?.logoUrl?.trim()
    ? tenant.logoUrl
    : "/logo-rooms.png"
  const navGroups = getDashboardNavigation({
    role: auth.role,
    platformRole: auth.platformRole,
    environment,
  }).filter((group) => !group.platformOnly)
  const notificationUnseenCount = useQuery(
    api.notifications.unseenCountByTenantSlug,
    { tenantSlug: auth.tenantSlug, auth }
  )
  const userName = displayNameFromUser(auth.user ?? { email: auth.email })

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
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white text-sidebar-primary-foreground">
                  <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-white">
                    <Image
                      src={tenantLogo}
                      alt={tenant?.tenantName ?? "Workspace"}
                      width={32}
                      height={32}
                      className="object-contain scale-110"
                      onError={(event) => {
                        if (!event.currentTarget.src.endsWith("/logo-rooms.png")) {
                          event.currentTarget.src = "/logo-rooms.png"
                        }
                      }}
                      priority
                      unoptimized
                    />
                  </span>
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
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Tenant Workspace
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
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          groups={navGroups}
          notificationUnseenCount={notificationUnseenCount ?? 0}
          selectedTenantSlug={auth.tenantSlug}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: userName || "Signed in",
            email: auth.email ?? auth.role ?? "Member",
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
