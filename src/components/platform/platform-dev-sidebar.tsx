"use client";

import Link from "next/link";
import { Code2Icon, LayoutDashboardIcon, LogOutIcon } from "lucide-react";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import type { PlatformDeveloperAuth } from "@/lib/platform-auth";
import { getDeveloperNavigationItems, type NavigationGroup } from "@/lib/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const developerGroups: NavigationGroup[] = [
  {
    title: "Developer",
    platformOnly: true,
    items: getDeveloperNavigationItems(),
  },
];

function developerInitial(email?: string) {
  return (email?.trim().slice(0, 1) || "D").toUpperCase();
}

export function PlatformDevSidebar({
  auth,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  auth?: PlatformDeveloperAuth;
}) {
  return (
    <Sidebar
      variant="sidebar"
      collapsible="offcanvas"
      className="border-r border-amber-500/20"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dev" />}
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                <Code2Icon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Developer</span>
                <span className="truncate text-xs text-amber-700 dark:text-amber-300">
                  Platform tools
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={developerGroups} />
        <NavSecondary
          items={[
            {
              title: "Main app",
              url: "/dashboard",
              icon: <LayoutDashboardIcon />,
            },
          ]}
          className="mt-auto border-t border-sidebar-border pt-2"
        />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/auth/sign-out" />}
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                {developerInitial(auth?.email)}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {auth?.email ?? "Developer"}
                </span>
                <span className="truncate text-xs">Sign out</span>
              </div>
              <LogOutIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
