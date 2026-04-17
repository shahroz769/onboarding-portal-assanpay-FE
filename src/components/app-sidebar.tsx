"use client"

import * as React from "react"

import { NavMain } from "#/components/nav-main"
import { NavUser } from "#/components/nav-user"
import { TeamSwitcher } from "#/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "#/components/ui/sidebar"
import { useAuth } from "#/features/auth/auth-client"
import { getFilteredNavItems } from "#/config/navigation"

const teams = [
  {
    name: "AssanPay",
    logo: "/favicon.svg",
    plan: "Onboarding Portal",
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()

  const navItems = React.useMemo(
    () => getFilteredNavItems(user?.roleType ?? "employee"),
    [user?.roleType]
  )

  const sidebarUser = {
    name: user?.name ?? "User",
    email: user?.email ?? "",
    avatar: "/favicon.svg",
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
