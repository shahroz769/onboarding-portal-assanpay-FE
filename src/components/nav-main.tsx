import { useEffect, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

import type { NavItem as SidebarNavItem } from '#/config/navigation'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '#/components/ui/sidebar'

function NavItem({
  item,
  pathname,
}: {
  item: SidebarNavItem
  pathname: string
}) {
  const isDirectActive =
    item.url === '/'
      ? pathname === item.url
      : pathname === item.url || pathname.startsWith(`${item.url}/`)
  const hasActiveChild = Boolean(
    item.items?.some((subItem) => pathname === subItem.url),
  )
  const shouldBeOpen = isDirectActive || hasActiveChild
  const [open, setOpen] = useState(shouldBeOpen)
  const labelClassName =
    'min-w-0 flex-1 truncate transition-opacity duration-150 group-data-[collapsible=icon]:opacity-0'

  useEffect(() => {
    if (shouldBeOpen) {
      setOpen(true)
    }
  }, [shouldBeOpen])

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
            <span className={labelClassName}>{item.title}</span>
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
          <SidebarMenuButton isActive={shouldBeOpen} tooltip={item.title}>
            {item.icon ? <item.icon /> : null}
            <span className={labelClassName}>{item.title}</span>
            <ChevronRight
              aria-hidden="true"
              className="ml-auto transition-[opacity,transform] duration-150 group-data-[collapsible=icon]:opacity-0 group-data-[state=open]/collapsible:rotate-90"
            />
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
  items: SidebarNavItem[]
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
