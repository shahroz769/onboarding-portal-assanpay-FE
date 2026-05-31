import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FilePlus2,
  Gauge,
  ShieldAlert,
  Store,
  UserCheck,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { cn } from '#/lib/utils'
import type { DashboardResponse } from '#/schemas/dashboard.schema'
import { formatCount, formatPercent } from './dashboard-utils'

type StatCardProps = {
  label: string
  value: string
  icon: LucideIcon
  hint?: string
  accent?: 'default' | 'positive' | 'warning' | 'danger'
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
}: StatCardProps) {
  return (
    <Card className="gap-0 py-4">
      <CardHeader className="px-4">
        <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
          <Icon className={cn('size-3.5', ACCENT_CLASSES[accent])} />
          {label}
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
        <StatCard label="New" value={formatCount(cases.new)} icon={FilePlus2} />
        <StatCard
          label="Working"
          value={formatCount(cases.working)}
          icon={Gauge}
        />
        <StatCard
          label="Closed"
          value={formatCount(cases.closed)}
          icon={CheckCircle2}
          accent="positive"
        />
        <StatCard
          label="Pending"
          value={formatCount(cases.pending + cases.awaitingClient)}
          icon={Clock}
          accent="warning"
        />
        <StatCard
          label="SLA breached"
          value={formatCount(cases.slaBreached)}
          icon={ShieldAlert}
          accent="danger"
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
        />
        <StatCard
          label="Live"
          value={formatCount(merchants.live)}
          icon={CheckCircle2}
          accent="positive"
        />
        <StatCard
          label="Testing"
          value={formatCount(merchants.testing)}
          icon={UserCheck}
        />
        <StatCard
          label="In process"
          value={formatCount(merchants.pending)}
          icon={Clock}
          accent="warning"
        />
        <StatCard
          label="Terminated"
          value={formatCount(merchants.terminated)}
          icon={ShieldAlert}
          accent="danger"
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
