"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
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

function NavItem({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const Icon = item.icon
  const isActive = isItemActive(item, pathname)
  const [open, setOpen] = useState(isActive)

  // Auto-expand when navigating to a child route
  useEffect(() => {
    if (isActive && !open) {
      setOpen(true)
    }
  }, [isActive, open])

  return (
    <Collapsible open={open} onOpenChange={setOpen} render={<SidebarMenuItem />}>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={isActive}
        render={<Link href={item.url} />}
      >
        {Icon ? <Icon /> : null}
        <span>{item.title}</span>
      </SidebarMenuButton>
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
}: {
  groups: NavigationGroup[]
}) {
  const pathname = usePathname()

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => (
              <NavItem key={item.title} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
