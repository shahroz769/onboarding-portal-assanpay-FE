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
  roles?: RoleType[]
  requiresWorkAccess?: boolean
  group?: string
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
    items: [
      {
        title: 'All Users',
        url: '/user-management/all-users',
      },
      {
        title: 'User Creation',
        url: '/user-management/user-creation',
      },
    ],
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
        title: 'Case Triggering',
        url: '/configuration/case-triggering',
        group: 'Case Workflow',
      },
      {
        title: 'Caseflow Builder',
        url: '/configuration/case-flow-rules',
        group: 'Case Workflow',
      },
      {
        title: 'Email Sending',
        url: '/configuration/email-sending',
        group: 'Communication',
      },
      {
        title: 'Link Deadlines',
        url: '/configuration/link-deadlines',
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
