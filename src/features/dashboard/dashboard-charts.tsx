import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '#/components/ui/chart'
import type { DashboardResponse } from '#/schemas/dashboard.schema'
import {
  caseFlowChartConfig,
  formatDay,
  queueStatusChartConfig,
  submissionsChartConfig,
} from './dashboard-utils'

export function DashboardCharts({ data }: { data: DashboardResponse }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <QueueCasesChart data={data} />
      <SubmissionTrendChart data={data} />
      <CaseFlowChart data={data} />
    </div>
  )
}

function QueueCasesChart({ data }: { data: DashboardResponse }) {
  const chartData = data.queues
    .filter((queue) => queue.total > 0)
    .map((queue) => ({
      name: queue.name,
      new: queue.new,
      working: queue.working,
      pending: queue.pending,
      closed: queue.closed,
    }))

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Cases by queue</CardTitle>
        <CardDescription>
          New, working, pending, and closed cases per queue
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer
            config={queueStatusChartConfig}
            className="aspect-auto h-72 w-full"
          >
            <BarChart accessibilityLayer data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="new"
                stackId="queue"
                fill="var(--color-new)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="working"
                stackId="queue"
                fill="var(--color-working)"
              />
              <Bar
                dataKey="pending"
                stackId="queue"
                fill="var(--color-pending)"
              />
              <Bar
                dataKey="closed"
                stackId="queue"
                fill="var(--color-closed)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function SubmissionTrendChart({ data }: { data: DashboardResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Form submissions</CardTitle>
        <CardDescription>Daily merchant form submissions</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={submissionsChartConfig}
          className="aspect-auto h-64 w-full"
        >
          <AreaChart accessibilityLayer data={data.trends.submissions}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={formatDay}
            />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} />
              }
            />
            <Area
              dataKey="count"
              type="monotone"
              fill="var(--color-count)"
              fillOpacity={0.2}
              stroke="var(--color-count)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function CaseFlowChart({ data }: { data: DashboardResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>New vs closed cases</CardTitle>
        <CardDescription>Daily intake and closures over the range</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={caseFlowChartConfig}
          className="aspect-auto h-64 w-full"
        >
          <BarChart accessibilityLayer data={data.trends.caseFlow}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={formatDay}
            />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="new" fill="var(--color-new)" radius={4} />
            <Bar dataKey="closed" fill="var(--color-closed)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      No data for this range
    </div>
  )
}
