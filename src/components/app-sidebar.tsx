"use client"

import * as React from "react"
import {
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  Users,
} from "lucide-react"

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

// This is sample data.
const data = {
  user: {
    name: "AssanPay",
    email: "onboarding@assanpay.com",
    avatar: "/favicon.svg",
  },
  teams: [
    {
      name: "AssanPay",
      logo: "/favicon.svg",
      plan: "Onboarding Portal",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Merchants",
      url: "/merchants",
      icon: BriefcaseBusiness,
    },
    {
      title: "Cases",
      url: "/cases",
      icon: ClipboardList,
      items: [
        {
          title: "All Cases",
          url: "/cases/all-cases",
        },
        {
          title: "My Open Cases",
          url: "/cases/my-open-cases",
        },
        {
          title: "My Closed Cases",
          url: "/cases/my-closed-cases",
        },
      ],
    },
    {
      title: "User Management",
      url: "/user-management",
      icon: Users,
      items: [
        {
          title: "All Users",
          url: "/user-management/all-users",
        },
        {
          title: "User Creation",
          url: "/user-management/user-creation",
        },
        {
          title: "Access Policy",
          url: "/user-management/access-policy",
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
