import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import {
  FileText,
  GitBranch,
  ListChecks,
  Mail,
  Send,
  Store,
  Timer,
  Wallet,
  Workflow,
} from 'lucide-react'

import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app/configuration')({
  staticData: {
    title: 'Configuration',
    subtitle: 'Manage portal-wide workflow and onboarding settings.',
  },
  component: RouteComponent,
})

const configurationNavItems = [
  {
    to: '/configuration/limits-and-mdr',
    label: 'Limits and MDR',
    icon: Wallet,
  },
  { to: '/configuration/agreements', label: 'Agreements', icon: FileText },
  { to: '/configuration/sub-merchants', label: 'Sub-Merchants', icon: Store },
  {
    to: '/configuration/payment-methods',
    label: 'Payment Methods',
    icon: Wallet,
  },
  { to: '/configuration/payout-methods', label: 'Payout Methods', icon: Send },
  { to: '/configuration/queues', label: 'Queues', icon: Workflow },
  {
    to: '/configuration/case-triggering',
    label: 'Case Triggering',
    icon: ListChecks,
  },
  {
    to: '/configuration/case-flow-rules',
    label: 'Case Flow Rules',
    icon: GitBranch,
  },
  { to: '/configuration/link-deadlines', label: 'Link Deadlines', icon: Timer },
  { to: '/configuration/email-sending', label: 'Email Sending', icon: Mail },
  {
    to: '/configuration/merchant-portal',
    label: 'Merchant Portal',
    icon: Send,
  },
] as const

function RouteComponent() {
  return (
    <div className="flex flex-col gap-6">
      <div className="inline-flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-lg bg-muted p-[3px] text-muted-foreground">
        {configurationNavItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeProps={{
              className:
                'border-transparent bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30',
            }}
            className={cn(
              'relative inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
            )}
          >
            <item.icon />
            {item.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
