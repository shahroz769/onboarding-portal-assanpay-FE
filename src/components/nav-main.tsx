import { Fragment, useEffect, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

import { cn } from '#/lib/utils'

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

const NAV_MENU_STATE_STORAGE_KEY = 'app-sidebar-collapsible-state'
const NAV_MENU_STATE_STORAGE_VERSION = 1

type VersionedNavMenuState = {
  v: number
  values: Record<string, boolean>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStoredNavMenuState(): Record<string, boolean> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const rawValue = window.localStorage.getItem(NAV_MENU_STATE_STORAGE_KEY)
    if (!rawValue) return {}

    const parsed: unknown = JSON.parse(rawValue)
    if (!isRecord(parsed)) return {}

    const values =
      parsed.v === NAV_MENU_STATE_STORAGE_VERSION && isRecord(parsed.values)
        ? parsed.values
        : typeof parsed.v === 'number'
          ? null
          : parsed

    if (!values) return {}

    return Object.fromEntries(
      Object.entries(values).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
      ),
    )
  } catch {
    return {}
  }
}

function writeStoredNavMenuState(nextState: Record<string, boolean>) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const payload: VersionedNavMenuState = {
      v: NAV_MENU_STATE_STORAGE_VERSION,
      values: nextState,
    }
    window.localStorage.setItem(
      NAV_MENU_STATE_STORAGE_KEY,
      JSON.stringify(payload),
    )
  } catch {
    // Storage full or blocked (private mode) — skip persist.
  }
}

function NavItem({
  item,
  pathname,
}: {
  item: SidebarNavItem
  pathname: string
}) {
  const activePrefix = item.activePrefix ?? item.url
  const isDirectActive =
    activePrefix === '/'
      ? pathname === item.url
      : pathname === item.url || pathname.startsWith(`${activePrefix}/`)
  const hasActiveChild = Boolean(
    item.items?.some((subItem) => pathname === subItem.url),
  )
  const shouldBeOpen = isDirectActive || hasActiveChild
  const [open, setOpen] = useState(() => {
    const storedState = readStoredNavMenuState()
    return shouldBeOpen || storedState[item.url] === true
  })
  const labelClassName =
    'min-w-0 flex-1 truncate transition-opacity duration-150 group-data-[collapsible=icon]:opacity-0'

  useEffect(() => {
    const storedState = readStoredNavMenuState()
    if (storedState[item.url] === open) {
      return
    }

    writeStoredNavMenuState({
      ...storedState,
      [item.url]: open,
    })
  }, [item.url, open])

  if (!item.items?.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link to={item.url} />}
          isActive={isDirectActive}
          tooltip={item.title}
        >
          {item.icon ? <item.icon /> : null}
          <span className={labelClassName}>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible
      render={<SidebarMenuItem />}
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <CollapsibleTrigger
        render={
          <SidebarMenuButton isActive={shouldBeOpen} tooltip={item.title} />
        }
      >
        {item.icon ? <item.icon /> : null}
        <span className={labelClassName}>{item.title}</span>
        <ChevronRight
          aria-hidden="true"
          className="ml-auto transition-[opacity,transform] duration-150 group-data-[collapsible=icon]:opacity-0 group-data-open/collapsible:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {item.items.map((subItem, index) => {
            const showGroupLabel =
              subItem.group !== undefined &&
              subItem.group !== item.items?.[index - 1]?.group

            return (
              <Fragment key={subItem.title}>
                {showGroupLabel ? (
                  <li
                    className={cn(
                      'px-2 pb-0.5 text-xs font-medium text-sidebar-foreground/60',
                      index === 0 ? 'pt-1' : 'pt-3',
                    )}
                  >
                    {subItem.group}
                  </li>
                ) : null}
                <SidebarMenuSubItem className="w-full">
                  <SidebarMenuSubButton
                    render={<Link to={subItem.url} />}
                    isActive={pathname === subItem.url}
                    className="w-full"
                  >
                    <span>{subItem.title}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </Fragment>
            )
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function NavMain({ items }: { items: SidebarNavItem[] }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <NavItem
            key={`${item.url}-${pathname}`}
            item={item}
            pathname={pathname}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
