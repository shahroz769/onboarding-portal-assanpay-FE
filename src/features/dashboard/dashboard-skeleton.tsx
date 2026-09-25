import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { DashboardKpiCards } from './dashboard-kpi-cards'
import { DashboardPortalMids } from './dashboard-portal-mids'
import { DASHBOARD_CHARTS } from './dashboard-utils'

// Mirrors HeaderStat in dashboard-charts.tsx: the label is real text so its
// line box matches; the value/hint skeletons equal their leading-none heights.
function HeaderStatSkeleton({
  label,
  hasHint = false,
}: {
  label: string
  hasHint?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      {/* h-4.5 = text-lg leading-none */}
      <Skeleton className="h-4.5 w-8 self-end" />
      {/* h-2.75 = text-[11px] leading-none */}
      {hasHint ? <Skeleton className="h-2.75 w-12 self-end" /> : null}
    </div>
  )
}

// Mirrors DailyCountBarChart's markup (recharts can't render until its lazy
// chunk arrives, so this can't reuse the real component like the others).
function ChartCardSkeleton({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-3">
          {/* h-9 = the rendered TabsList height (the horizontal-tabs h-9 rule
              outranks the chart's h-7) */}
          <Skeleton className="h-9 w-30 rounded-lg" />
          <div className="flex items-start gap-5 text-right">
            <HeaderStatSkeleton label="Total" />
            <HeaderStatSkeleton label="Daily avg" />
            <HeaderStatSkeleton label="Peak" hasHint />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full rounded-md" />
      </CardContent>
    </Card>
  )
}

export function DashboardChartsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {DASHBOARD_CHARTS.map((chart) => (
        <ChartCardSkeleton
          key={chart.key}
          title={chart.title}
          description={chart.description}
        />
      ))}
    </div>
  )
}

// KPI cards and portal MIDs render their own loading state, so their layout
// is identical to the loaded page by construction.
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardKpiCards />
      <DashboardChartsSkeleton />
      <DashboardPortalMids />
    </div>
  )
}
