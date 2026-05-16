"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import type { NavigationGroup, NavigationItem } from "@/lib/navigation"
import { ChevronRightIcon } from "lucide-react"

function isItemActive(item: NavigationItem, pathname: string): boolean {
  if (pathname === item.url) return true
  if (item.url !== "/dashboard" && pathname.startsWith(item.url)) return true
  return item.items?.some((child) => isItemActive(child, pathname)) ?? false
}

function NavItem({
  item,
  pathname,
  notificationUnseenCount,
}: {
  item: NavigationItem;
  pathname: string;
  notificationUnseenCount?: number;
}) {
  const Icon = item.icon
  const isActive = isItemActive(item, pathname)
  const [open, setOpen] = useState(false)
  const isOpen = open || isActive
  const notificationBadge =
    item.url === "/dashboard/notifications" && notificationUnseenCount
      ? notificationUnseenCount
      : 0

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen} render={<SidebarMenuItem />}>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={isActive}
        render={<Link href={item.url} />}
      >
        {Icon ? <Icon /> : null}
        <span>{item.title}</span>
      </SidebarMenuButton>
      {notificationBadge > 0 ? (
        <SidebarMenuBadge aria-label={`${notificationBadge} unseen notifications`}>
          {notificationBadge > 99 ? "99+" : notificationBadge}
        </SidebarMenuBadge>
      ) : null}
      {item.items?.length ? (
        <>
          <CollapsibleTrigger
            render={
              <SidebarMenuAction className="aria-expanded:rotate-90" />
            }
          >
            <ChevronRightIcon />
            <span className="sr-only">Toggle</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.items.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    isActive={isItemActive(subItem, pathname)}
                    render={<Link href={subItem.url} />}
                  >
                    <span>{subItem.title}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </>
      ) : null}
    </Collapsible>
  )
}

export function NavMain({
  groups,
  notificationUnseenCount,
}: {
  groups: NavigationGroup[]
  notificationUnseenCount?: number
}) {
  const pathname = usePathname()

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => (
              <NavItem
                key={item.title}
                item={item}
                pathname={pathname}
                notificationUnseenCount={notificationUnseenCount}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
