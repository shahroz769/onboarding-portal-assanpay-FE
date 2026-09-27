import {
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  Settings2,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FileRouteTypes } from '@tanstack/react-router'

import type { RoleType } from '#/types/auth'

type AppPath = FileRouteTypes['to']

export type NavSubItem = {
  title: string
  url: AppPath
  /** Values for the `$param` segments in `url`. */
  params?: Record<string, string>
  roles?: RoleType[]
  requiresWorkAccess?: boolean
  group?: string
}

/** Resolves a sub-item's `$param` segments into the real pathname. */
export function getNavSubItemPath(item: NavSubItem): string {
  return item.url.replace(
    /\$(\w+)/g,
    (segment: string, name: string) => item.params?.[name] ?? segment,
  )
}

export type NavItem = {
  title: string
  url: AppPath
  activePrefix?: string
  icon?: LucideIcon
  roles?: RoleType[]
  items?: NavSubItem[]
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Merchants',
    url: '/merchants',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Cases',
    url: '/cases',
    icon: ClipboardList,
    items: [
      {
        title: 'All Cases',
        url: '/cases/all-cases',
      },
      {
        title: 'Work Queue Cases',
        url: '/cases/work-queue-cases',
        roles: ['agent'],
        requiresWorkAccess: true,
      },
      {
        title: 'My Open Cases',
        url: '/cases/my-open-cases',
      },
      {
        title: 'My Closed Cases',
        url: '/cases/my-closed-cases',
      },
    ],
  },
  {
    title: 'User Management',
    url: '/user-management',
    icon: Users,
    roles: ['super_admin', 'admin'],
  },
  {
    title: 'Configuration',
    url: '/configuration/limits-and-mdr',
    activePrefix: '/configuration',
    icon: Settings2,
    roles: ['super_admin', 'admin'],
    items: [
      {
        title: 'Limits & MDR',
        url: '/configuration/limits-and-mdr',
        group: 'Pricing & Methods',
      },
      {
        title: 'Payment Methods',
        url: '/configuration/payment-methods',
        group: 'Pricing & Methods',
      },
      {
        title: 'Payout Methods',
        url: '/configuration/payout-methods',
        group: 'Pricing & Methods',
      },
      {
        title: 'Agreements',
        url: '/configuration/agreements',
        group: 'Merchant Onboarding',
      },
      {
        title: 'Sub-Merchants',
        url: '/configuration/sub-merchants',
        group: 'Merchant Onboarding',
      },
      {
        title: 'Portal & Support',
        url: '/configuration/merchant-portal',
        group: 'Merchant Onboarding',
      },
      {
        title: 'Queues',
        url: '/configuration/queues',
        group: 'Case Workflow',
      },
      {
        title: 'Caseflow Builder',
        url: '/configuration/case-flow-rules',
        group: 'Case Workflow',
      },
      {
        title: 'Emails',
        url: '/configuration/email-templates',
        group: 'Communication',
      },
    ],
  },
]

export function getFilteredNavItems(
  roleType: RoleType,
  hasWorkingAccess = false,
): NavItem[] {
  return navItems
    .filter((item) => !item.roles || item.roles.includes(roleType))
    .map((item) => {
      if (!item.items) return item
      const filteredSubItems = item.items.filter(
        (sub) =>
          (!sub.roles || sub.roles.includes(roleType)) &&
          (!sub.requiresWorkAccess || hasWorkingAccess),
      )
      return { ...item, items: filteredSubItems }
    })
}
