"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "#/components/ui/avatar"
import {
  SidebarMenuButton,
  SidebarMenu,
  SidebarMenuItem,
} from "#/components/ui/sidebar"

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: string
    plan: string
  }[]
}) {
  const activeTeam = teams[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg">
          <div>
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={activeTeam.logo} alt={activeTeam.name} />
              <AvatarFallback className="rounded-lg">AP</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{activeTeam.name}</span>
              <span className="truncate text-xs">{activeTeam.plan}</span>
            </div>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
