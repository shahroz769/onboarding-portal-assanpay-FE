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

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app/configuration')({
  component: RouteComponent,
})

const configurationNavItems = [
  { to: '/configuration/limits-and-mdr', label: 'Limits and MDR', icon: Wallet },
  { to: '/configuration/agreements', label: 'Agreements', icon: FileText },
  { to: '/configuration/sub-merchants', label: 'Sub-Merchants', icon: Store },
  { to: '/configuration/payment-methods', label: 'Payment Methods', icon: Wallet },
  { to: '/configuration/payout-methods', label: 'Payout Methods', icon: Send },
  { to: '/configuration/queues', label: 'Queues', icon: Workflow },
  { to: '/configuration/case-triggering', label: 'Case Triggering', icon: ListChecks },
  { to: '/configuration/case-flow-rules', label: 'Case Flow Rules', icon: GitBranch },
  { to: '/configuration/link-deadlines', label: 'Link Deadlines', icon: Timer },
  { to: '/configuration/email-sending', label: 'Email Sending', icon: Mail },
  { to: '/configuration/merchant-portal', label: 'Merchant Portal', icon: Send },
] as const

function RouteComponent() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {configurationNavItems.map((item) => (
          <Button key={item.to} asChild variant="outline" size="sm">
            <Link
              to={item.to}
              activeProps={{
                className: 'border-primary bg-primary text-primary-foreground',
              }}
              className={cn('gap-2')}
            >
              <item.icon />
              {item.label}
            </Link>
          </Button>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
