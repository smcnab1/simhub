"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = isItemActive(item, pathname)

              return (
                <Collapsible
                  key={item.title}
                  defaultOpen={isActive}
                  render={<SidebarMenuItem />}
                >
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
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
