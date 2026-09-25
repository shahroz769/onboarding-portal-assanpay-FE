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
import { Skeleton } from '#/components/ui/skeleton'
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
  /** null while the dashboard is loading: renders a same-size skeleton. */
  value: string | null
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
        <CardTitle className="text-2xl tabular-nums">
          {/* h-lh = exactly one line of the value's text, whatever the
              computed line-height is (cn drops CardTitle's leading-none) */}
          {value ?? <Skeleton className="h-lh w-10" />}
        </CardTitle>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )

  if (!link || value === null) return card

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

/** Without `data`, renders the loading state with the exact loaded layout. */
export function DashboardKpiCards({ data }: { data?: DashboardResponse }) {
  const cases = data?.cases
  const merchants = data?.merchants
  const count = (value: number | undefined) =>
    value === undefined ? null : formatCount(value)

  return (
    <div className="flex flex-col gap-6">
      <Section title="Cases">
        <StatCard
          label="New"
          value={count(cases?.new)}
          icon={FilePlus2}
          link={{ to: '/cases/all-cases', statuses: ['new'] }}
        />
        <StatCard
          label="Working"
          value={count(cases?.working)}
          icon={Gauge}
          link={{ to: '/cases/all-cases', statuses: ['working'] }}
        />
        <StatCard
          label="Closed"
          value={count(cases?.closed)}
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
          value={count(cases?.pending)}
          icon={Clock}
          accent="warning"
          link={{ to: '/cases/all-cases', statuses: ['pending'] }}
        />
        <StatCard
          label="Awaiting merchant"
          value={count(cases?.awaitingClient)}
          icon={Hourglass}
          accent="warning"
          link={{ to: '/cases/all-cases', statuses: ['awaiting_client'] }}
        />
        <StatCard
          label="Breach rate"
          value={cases ? formatPercent(cases.breachRate) : null}
          icon={AlertTriangle}
          accent={cases && cases.breachRate > 10 ? 'danger' : 'default'}
        />
      </Section>

      <Section title="Merchants">
        <StatCard
          label="Total merchants"
          value={count(merchants?.total)}
          icon={Store}
          link={{ to: '/merchants', statuses: MERCHANT_STATUSES }}
        />
        <StatCard
          label="Live"
          value={count(merchants?.live)}
          icon={CheckCircle2}
          accent="positive"
          link={{ to: '/merchants', statuses: ['live'] }}
        />
        <StatCard
          label="Testing"
          value={count(merchants?.testing)}
          icon={UserCheck}
          link={{ to: '/merchants', statuses: ['testing'] }}
        />
        <StatCard
          label="In process"
          value={count(merchants?.pending)}
          icon={Clock}
          accent="warning"
          link={{ to: '/merchants', statuses: ['pending'] }}
        />
        <StatCard
          label="Terminated"
          value={count(merchants?.terminated)}
          icon={ShieldAlert}
          accent="danger"
          link={{ to: '/merchants', statuses: ['terminated'] }}
        />
        <StatCard
          label="Form submissions"
          value={count(merchants?.submittedInRange)}
          icon={FilePlus2}
        />
      </Section>
    </div>
  )
}
