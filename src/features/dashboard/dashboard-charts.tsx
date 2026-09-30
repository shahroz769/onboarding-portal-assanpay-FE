import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { EmptyState } from '#/components/empty-state'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import type { ChartConfig } from '#/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '#/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useReducedMotion } from '#/hooks/use-reduced-motion'
import type { DashboardResponse } from '#/schemas/dashboard.schema'
import type { DailyCountPoint } from './dashboard-utils'
import { HeaderStat } from './dashboard-header-stat'

// Workload charts share this lazy chunk so recharts loads once.
export { WorkloadBarChart } from './dashboard-workload-chart'
import {
  DASHBOARD_CHARTS,
  aggregateByWeek,
  formatCount,
  formatDay,
  formatWeekRange,
} from './dashboard-utils'

export function DashboardCharts({ data }: { data: DashboardResponse }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {DASHBOARD_CHARTS.map((chart) => (
        <DailyCountBarChart
          key={chart.key}
          title={chart.title}
          description={chart.description}
          emptyTitle={chart.emptyTitle}
          data={data.trends[chart.key]}
          config={chart.config}
        />
      ))}
    </div>
  )
}

const formatAverage = (value: number) => value.toFixed(1)

type Granularity = 'daily' | 'weekly'

function DailyCountBarChart({
  title,
  description,
  emptyTitle,
  data,
  config,
}: {
  title: string
  description: string
  emptyTitle: string
  data: DailyCountPoint[]
  config: ChartConfig
}) {
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const reducedMotion = useReducedMotion()

  const points = granularity === 'weekly' ? aggregateByWeek(data) : data
  const total = points.reduce((sum, day) => sum + day.count, 0)
  const average = points.length > 0 ? total / points.length : 0
  const peak = points.reduce<DailyCountPoint | null>(
    (max, day) => (max === null || day.count > max.count ? day : max),
    null,
  )

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Tabs
            value={granularity}
            onValueChange={(value) => setGranularity(value as Granularity)}
          >
            <TabsList className="group-data-[orientation=horizontal]/tabs:h-7">
              <TabsTrigger value="daily" className="px-2.5 text-xs">
                Daily
              </TabsTrigger>
              <TabsTrigger value="weekly" className="px-2.5 text-xs">
                Weekly
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-start gap-5 text-right">
            <HeaderStat label="Total" value={total} format={formatCount} />
            <HeaderStat
              label={granularity === 'weekly' ? 'Weekly avg' : 'Daily avg'}
              value={average}
              format={formatAverage}
            />
            {/* With every point at 0, the first day would win "peak". */}
            {peak && peak.count > 0 ? (
              <HeaderStat
                label="Peak"
                value={peak.count}
                format={formatCount}
                hint={formatDay(peak.date)}
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          // Same height as the chart, so the card doesn't shrink.
          <EmptyState
            icon={BarChart3}
            title={emptyTitle}
            description="Try a wider date range."
            className="h-64 py-0"
          />
        ) : (
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart
              accessibilityLayer
              data={points}
              margin={{ top: 8 }}
              barCategoryGap="28%"
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={formatDay}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={{ opacity: 0.5 }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      granularity === 'weekly'
                        ? formatWeekRange(String(value))
                        : formatDay(String(value))
                    }
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
                isAnimationActive={!reducedMotion}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
