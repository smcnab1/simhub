"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import {
  ChevronsUpDownIcon,
  BookOpenIcon,
  LifeBuoyIcon,
  LightbulbIcon,
  LogOutIcon,
  MapIcon,
  MegaphoneIcon,
} from "lucide-react"
import { useFeaturebase } from "@/hooks/use-featurebase"
import {
  FEATUREBASE_CHANGELOG_URL,
  FEATUREBASE_FEEDBACK_URL,
  FEATUREBASE_HELP_URL,
  FEATUREBASE_ROADMAP_URL,
} from "@/lib/featurebase"

const visibleVersionTypes = new Set(["alpha", "beta", "dev", "test"])

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const featurebase = useFeaturebase()
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION
  const versionType = process.env.NEXT_PUBLIC_VERSION_TYPE?.toLowerCase()
  const showVersion = Boolean(
    appVersion && versionType && visibleVersionTypes.has(versionType)
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar>
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground">
              Support
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={(event) => {
                event.preventDefault()
                featurebase.show()
              }}
            >
              <LifeBuoyIcon />
              Help desk
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={FEATUREBASE_HELP_URL} target="_blank" rel="noreferrer" />}
            >
              <BookOpenIcon />
              Knowledge base
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={FEATUREBASE_FEEDBACK_URL} target="_blank" rel="noreferrer" />}
            >
              <LightbulbIcon />
              Feedback & Suggestions
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={FEATUREBASE_ROADMAP_URL} target="_blank" rel="noreferrer" />}
            >
              <MapIcon />
              Roadmap
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={FEATUREBASE_CHANGELOG_URL} target="_blank" rel="noreferrer" />}
            >
              <MegaphoneIcon />
              Changelog
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<a href="/auth/sign-out" />}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
            {showVersion ? (
              <>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-xs text-muted-foreground">
                  <span className="font-mono">v{appVersion}</span>
                  <Badge variant="outline" className="uppercase">
                    {versionType}
                  </Badge>
                </div>
              </>
            ) : null}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
