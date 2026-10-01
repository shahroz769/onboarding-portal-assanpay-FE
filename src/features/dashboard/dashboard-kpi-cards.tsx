import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpRight,
  ChartPie,
  CheckCircle2,
  Clock,
  ClockAlert,
  FilePlus2,
  Gauge,
  Hourglass,
  ShieldAlert,
  Store,
  UserCheck,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { NumberFlip } from '#/components/number-flip'
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
import { MERCHANT_STATUSES } from '#/schemas/merchants.schema'
import type { MerchantStatus } from '#/schemas/merchants.schema'
import { formatCount } from './dashboard-utils'

/** Opens the cases or merchants list pre-filtered to the card's statuses. */
type StatCardLink =
  | { to: '/cases/all-cases'; statuses: ReadonlyArray<CaseFilterStatus> }
  | { to: '/merchants'; statuses: ReadonlyArray<MerchantStatus> }

type StatCardProps = {
  label: string
  /** null while the dashboard is loading: renders a same-size skeleton. */
  value: number | null
  format?: (value: number) => string
  icon: LucideIcon
  hint?: string
  accent?: 'default' | 'positive' | 'warning' | 'danger'
  link?: StatCardLink
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps['accent']>, string> = {
  default: 'text-muted-foreground',
  positive: 'text-foreground',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
}

function StatCard({
  label,
  value,
  format = formatCount,
  icon: Icon,
  hint,
  accent = 'default',
  link,
}: StatCardProps) {
  const card = (
    <Card
      className={cn(
        'h-full gap-0 py-4',
        // In dark mode muted/40 over the card is nearly invisible, so the
        // hover uses a stronger muted plus a lighter border there.
        link &&
          'transition-colors group-hover:bg-muted/40 dark:group-hover:border-foreground/15 dark:group-hover:bg-muted/70',
      )}
    >
      <CardHeader className="px-4">
        <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
          <Icon className={cn('size-3.5', ACCENT_CLASSES[accent])} />
          {label}
          {link ? (
            <ArrowUpRight className="ml-auto size-3.5 text-muted-foreground/70 transition-[color,translate] duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground group-focus-visible:translate-x-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:text-foreground motion-reduce:transition-none" />
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <CardTitle className="text-2xl tabular-nums">
          {/* h-lh = exactly one line of the value's text, whatever the
              computed line-height is (cn drops CardTitle's leading-tight) */}
          {value === null ? (
            <Skeleton className="h-lh w-10" />
          ) : (
            // Changed digits roll when the value changes (e.g. a range
            // switch); the first value replaces the skeleton as is.
            <NumberFlip value={value} format={format} />
          )}
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
      aria-label={`${label}: ${format(value)}. View list`}
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

const formatPercent = (value: number) => `${value.toFixed(1)}%`

/** Without `data`, renders the loading state with the exact loaded layout. */
export function DashboardKpiCards({ data }: { data?: DashboardResponse }) {
  const cases = data?.cases
  const merchants = data?.merchants
  const count = (value: number | undefined) => value ?? null
  const liveRate = merchants
    ? merchants.total > 0
      ? (merchants.live / merchants.total) * 100
      : 0
    : null
  const breachRate = cases
    ? cases.slaEvaluated > 0
      ? (cases.slaBreached / cases.slaEvaluated) * 100
      : 0
    : null

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
          label="Awaiting merchant"
          value={count(cases?.awaitingMerchant)}
          icon={Hourglass}
          accent="warning"
          link={{ to: '/cases/all-cases', statuses: ['awaiting_merchant'] }}
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
          label="SLA breaches"
          value={count(cases?.slaBreached)}
          icon={ClockAlert}
          accent="danger"
        />
        <StatCard
          label="SLA breach rate"
          value={breachRate}
          format={formatPercent}
          icon={ChartPie}
          accent="danger"
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
          label="Live rate"
          value={liveRate}
          format={formatPercent}
          icon={ChartPie}
        />
      </Section>
    </div>
  )
}
