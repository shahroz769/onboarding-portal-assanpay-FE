"use client"

import { useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronRight, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "#/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "#/components/ui/sidebar"

function NavItem({
  item,
  pathname,
}: {
  item: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }
  pathname: string
}) {
  const isDirectActive = pathname === item.url
  const hasActiveChild = Boolean(
    item.items?.some((subItem) => pathname === subItem.url)
  )
  const [open, setOpen] = useState(
    isDirectActive || hasActiveChild || !!item.isActive
  )

  if (!item.items?.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isDirectActive}
          tooltip={item.title}
        >
          <Link to={item.url}>
            {item.icon ? <item.icon /> : null}
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    isActive={isDirectActive}
                    tooltip={item.title}
                  >
                    {item.icon ? <item.icon /> : null}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title} className="w-full">
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === subItem.url}
                          className="w-full"
                        >
                          <Link to={subItem.url}>
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
  )
}

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <NavItem key={item.title} item={item} pathname={pathname} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
