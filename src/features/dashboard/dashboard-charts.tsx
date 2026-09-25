import { useId, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

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
import type { DashboardResponse } from '#/schemas/dashboard.schema'
import type { DailyCountPoint } from './dashboard-utils'
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
          data={data.trends[chart.key]}
          config={chart.config}
        />
      ))}
    </div>
  )
}

function HeaderStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-lg leading-none font-semibold tabular-nums">
        {value}
      </span>
      {hint ? (
        <span className="text-[11px] leading-none text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

type Granularity = 'daily' | 'weekly'

function DailyCountBarChart({
  title,
  description,
  data,
  config,
}: {
  title: string
  description: string
  data: DailyCountPoint[]
  config: ChartConfig
}) {
  const gradientId = `daily-count-fill-${useId().replace(/:/g, '')}`
  const [granularity, setGranularity] = useState<Granularity>('daily')

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
            <TabsList className="h-7">
              <TabsTrigger value="daily" className="px-2.5 text-xs">
                Daily
              </TabsTrigger>
              <TabsTrigger value="weekly" className="px-2.5 text-xs">
                Weekly
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-start gap-5 text-right">
            <HeaderStat label="Total" value={formatCount(total)} />
            <HeaderStat
              label={granularity === 'weekly' ? 'Weekly avg' : 'Daily avg'}
              value={average.toFixed(1)}
            />
            {peak ? (
              <HeaderStat
                label="Peak"
                value={formatCount(peak.count)}
                hint={formatDay(peak.date)}
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart
            accessibilityLayer
            data={points}
            margin={{ top: 8 }}
            barCategoryGap="28%"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  style={{ stopColor: 'var(--color-count)', stopOpacity: 1 }}
                />
                <stop
                  offset="100%"
                  style={{ stopColor: 'var(--color-count)', stopOpacity: 0.45 }}
                />
              </linearGradient>
            </defs>
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
              fill={`url(#${gradientId})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
