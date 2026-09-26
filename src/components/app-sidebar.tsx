import * as React from 'react'

import { NavMain } from '#/components/nav-main'
import { TeamSwitcher } from '#/components/team-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '#/components/ui/sidebar'
import { useAuth } from '#/features/auth/auth-client'
import { getFilteredNavItems } from '#/config/navigation'

const teams = [
  {
    name: 'AssanPay',
    logo: '/favicon.svg',
    plan: 'Onboarding Portal',
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()

  const navItems = getFilteredNavItems(
    user?.roleType ?? 'agent',
    Boolean(user?.workQueueIds.length),
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
