import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { DashboardKpiCards } from './dashboard-kpi-cards'
import { DashboardAwaitingAgreements } from './dashboard-awaiting-agreements'
import { DashboardPortalMids } from './dashboard-portal-mids'
import { DashboardWorkload } from './dashboard-workload'
import { DASHBOARD_CHARTS } from './dashboard-utils'
import { HeaderStatSkeleton } from './dashboard-header-stat'

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
          {/* h-7 = the chart's compact TabsList height */}
          <Skeleton className="h-7 w-30 rounded-lg" />
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

// KPI cards, workload and portal MIDs render their own loading state, so their layout
// is identical to the loaded page by construction.
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardKpiCards />
      <DashboardChartsSkeleton />
      <DashboardWorkload />
      {/* Two columns, matching the chart grid above. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPortalMids />
        <DashboardAwaitingAgreements />
      </div>
    </div>
  )
}
