import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import {
  CreditCard,
  FileText,
  GitBranch,
  Headset,
  Mail,
  Play,
  Send,
  Store,
  Timer,
  Wallet,
  Workflow,
} from 'lucide-react'

import { cn } from '#/lib/utils'
import { requireAllowedRoles } from '#/features/auth/route-guards'

export const Route = createFileRoute('/_app/configuration')({
  beforeLoad: ({ context }) => {
    requireAllowedRoles(context.auth, ['super_admin', 'admin'])
  },
  staticData: {
    title: 'Configuration',
    subtitle: 'Manage portal-wide workflow and onboarding settings.',
  },
  component: RouteComponent,
})

const configurationNavGroups = [
  {
    label: 'Payments',
    items: [
      {
        to: '/configuration/limits-and-mdr',
        label: 'Limits & MDR',
        icon: Wallet,
      },
      {
        to: '/configuration/payment-methods',
        label: 'Payment Methods',
        icon: CreditCard,
      },
      {
        to: '/configuration/payout-methods',
        label: 'Payout Methods',
        icon: Send,
      },
    ],
  },
  {
    label: 'Onboarding',
    items: [
      { to: '/configuration/agreements', label: 'Agreements', icon: FileText },
      {
        to: '/configuration/sub-merchants',
        label: 'Sub-Merchants',
        icon: Store,
      },
      {
        to: '/configuration/merchant-portal',
        label: 'Portal & Support',
        icon: Headset,
      },
    ],
  },
  {
    label: 'Workflow',
    items: [
      { to: '/configuration/queues', label: 'Queues', icon: Workflow },
      {
        to: '/configuration/case-triggering',
        label: 'Case Triggering',
        icon: Play,
      },
      {
        to: '/configuration/case-flow-rules',
        label: 'Caseflow Builder',
        icon: GitBranch,
      },
      {
        to: '/configuration/link-deadlines',
        label: 'Link Deadlines',
        icon: Timer,
      },
      {
        to: '/configuration/email-sending',
        label: 'Email Sending',
        icon: Mail,
      },
    ],
  },
] as const

function RouteComponent() {
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <nav
        aria-label="Configuration sections"
        className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:flex-col lg:overflow-visible lg:pb-0"
      >
        {configurationNavGroups.map((group, groupIndex) => (
          <div key={group.label} className="flex shrink-0 gap-1 lg:flex-col">
            <p
              className={cn(
                'hidden px-3 pb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase lg:block',
                groupIndex > 0 && 'lg:pt-4',
              )}
            >
              {group.label}
            </p>
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{
                  className: 'bg-accent font-medium text-foreground',
                }}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0',
                )}
              >
                <item.icon />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
