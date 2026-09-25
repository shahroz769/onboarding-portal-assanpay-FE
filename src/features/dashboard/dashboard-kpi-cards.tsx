import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FilePlus2,
  Gauge,
  Hourglass,
  ShieldAlert,
  Store,
  UserCheck,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { cn } from '#/lib/utils'
import type { DashboardResponse } from '#/schemas/dashboard.schema'
import type { CaseFilterStatus } from '#/schemas/cases.schema'
import {
  MERCHANT_STATUSES,
  type MerchantStatus,
} from '#/schemas/merchants.schema'
import { formatCount, formatPercent } from './dashboard-utils'

/** Opens the cases or merchants list pre-filtered to the card's statuses. */
type StatCardLink =
  | { to: '/cases/all-cases'; statuses: ReadonlyArray<CaseFilterStatus> }
  | { to: '/merchants'; statuses: ReadonlyArray<MerchantStatus> }

type StatCardProps = {
  label: string
  value: string
  icon: LucideIcon
  hint?: string
  accent?: 'default' | 'positive' | 'warning' | 'danger'
  link?: StatCardLink
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps['accent']>, string> = {
  default: 'text-muted-foreground',
  positive: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = 'default',
  link,
}: StatCardProps) {
  const card = (
    <Card
      className={cn(
        'h-full gap-0 py-4',
        link && 'transition-colors group-hover:bg-muted/40',
      )}
    >
      <CardHeader className="px-4">
        <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
          <Icon className={cn('size-3.5', ACCENT_CLASSES[accent])} />
          {label}
          {link ? (
            <ArrowUpRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )

  if (!link) return card

  return (
    <Link
      to={link.to}
      search={{ status: link.statuses.join(',') }}
      aria-label={`${label}: ${value}. View list`}
      className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {children}
      </div>
    </section>
  )
}

export function DashboardKpiCards({ data }: { data: DashboardResponse }) {
  const { cases, merchants } = data

  return (
    <div className="flex flex-col gap-6">
      <Section title="Cases">
        <StatCard
          label="New"
          value={formatCount(cases.new)}
          icon={FilePlus2}
          link={{ to: '/cases/all-cases', statuses: ['new'] }}
        />
        <StatCard
          label="Working"
          value={formatCount(cases.working)}
          icon={Gauge}
          link={{ to: '/cases/all-cases', statuses: ['working'] }}
        />
        <StatCard
          label="Closed"
          value={formatCount(cases.closed)}
          icon={CheckCircle2}
          accent="positive"
          // The closed count includes unsuccessful closures, which the list
          // only shows when that filter is selected explicitly.
          link={{
            to: '/cases/all-cases',
            statuses: ['closed', 'unsuccessful'],
          }}
        />
        <StatCard
          label="Pending"
          value={formatCount(cases.pending)}
          icon={Clock}
          accent="warning"
          link={{ to: '/cases/all-cases', statuses: ['pending'] }}
        />
        <StatCard
          label="Awaiting merchant"
          value={formatCount(cases.awaitingClient)}
          icon={Hourglass}
          accent="warning"
          link={{ to: '/cases/all-cases', statuses: ['awaiting_client'] }}
        />
        <StatCard
          label="Breach rate"
          value={formatPercent(cases.breachRate)}
          icon={AlertTriangle}
          accent={cases.breachRate > 10 ? 'danger' : 'default'}
        />
      </Section>

      <Section title="Merchants">
        <StatCard
          label="Total merchants"
          value={formatCount(merchants.total)}
          icon={Store}
          link={{ to: '/merchants', statuses: MERCHANT_STATUSES }}
        />
        <StatCard
          label="Live"
          value={formatCount(merchants.live)}
          icon={CheckCircle2}
          accent="positive"
          link={{ to: '/merchants', statuses: ['live'] }}
        />
        <StatCard
          label="Testing"
          value={formatCount(merchants.testing)}
          icon={UserCheck}
          link={{ to: '/merchants', statuses: ['testing'] }}
        />
        <StatCard
          label="In process"
          value={formatCount(merchants.pending)}
          icon={Clock}
          accent="warning"
          link={{ to: '/merchants', statuses: ['pending'] }}
        />
        <StatCard
          label="Terminated"
          value={formatCount(merchants.terminated)}
          icon={ShieldAlert}
          accent="danger"
          link={{ to: '/merchants', statuses: ['terminated'] }}
        />
        <StatCard
          label="Form submissions"
          value={formatCount(merchants.submittedInRange)}
          icon={FilePlus2}
        />
      </Section>
    </div>
  )
}
