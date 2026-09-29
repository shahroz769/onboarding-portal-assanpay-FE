import { Bar, BarChart, CartesianGrid, Rectangle, XAxis, YAxis } from 'recharts'
import type { BarShapeProps } from 'recharts'

import type { ChartConfig } from '#/components/ui/chart'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from '#/components/ui/chart'
import { useReducedMotion } from '#/hooks/use-reduced-motion'
import { cn } from '#/lib/utils'
import { formatCount } from './dashboard-utils'
import type { OpenStatusKey } from './dashboard-workload-utils'
import { WORKLOAD_SERIES } from './dashboard-workload-utils'

// Legend and tooltip use the badge swatch (fill + ring) instead of a bare
// square, since the badge backgrounds are too pale on their own.
const workloadChartConfig = Object.fromEntries(
  WORKLOAD_SERIES.map((series) => [
    series.key,
    {
      label: series.label,
      theme: series.fill,
      icon: () => (
        <span
          className={cn(
            'size-2.5 shrink-0 rounded-[2px]',
            series.swatchClassName,
          )}
        />
      ),
    },
  ]),
) satisfies ChartConfig

export type WorkloadChartRow = {
  id: string
  label: string
  new: number
  working: number
  awaitingMerchant: number
  open: number
}

const ROW_HEIGHT = 36
// Matches the vertical charts' bars as they render at the default 30 days:
// slim, rounded 6px at the value end only, square where the bar starts.
const BAR_SIZE = 12
const BAR_END_RADIUS: [number, number, number, number] = [0, 6, 6, 0]
// X axis + legend below the rows.
const CHART_CHROME_HEIGHT = 64
const LABEL_MAX_CHARS = 18

function truncateLabel(value: string) {
  return value.length > LABEL_MAX_CHARS
    ? `${value.slice(0, LABEL_MAX_CHARS - 1)}…`
    : value
}

/**
 * Horizontal stacked bars, one row per queue or person; the tooltip carries
 * the exact counts. Clicking a segment opens those cases.
 */
export function WorkloadBarChart({
  rows,
  onSelect,
}: {
  rows: WorkloadChartRow[]
  onSelect: (row: WorkloadChartRow, key: OpenStatusKey) => void
}) {
  const reducedMotion = useReducedMotion()
  // Only series with cases get a bar (and a legend entry).
  const visibleSeries = WORKLOAD_SERIES.filter((item) =>
    rows.some((row) => row[item.key] > 0),
  )

  return (
    <ChartContainer
      config={workloadChartConfig}
      className="aspect-auto w-full"
      style={{ height: rows.length * ROW_HEIGHT + CHART_CHROME_HEIGHT }}
    >
      <BarChart
        accessibilityLayer
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={136}
          tickFormatter={truncateLabel}
        />
        <ChartTooltip
          cursor={{ opacity: 0.5 }}
          content={({ active, payload }) => (
            <WorkloadTooltip active={active} payload={payload} />
          )}
        />
        <ChartLegend
          content={<ChartLegendContent />}
          // Legend follows the stack order, not the alphabet.
          itemSorter={(item) =>
            WORKLOAD_SERIES.findIndex((series) => series.key === item.dataKey)
          }
        />
        {visibleSeries.map((item) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            stackId="open"
            fill={`var(--color-${item.key})`}
            // A card-colored edge separates touching segments.
            stroke="var(--card)"
            strokeWidth={2}
            barSize={BAR_SIZE}
            // Only the row's last filled segment gets the rounded end.
            shape={(props: BarShapeProps) => (
              <Rectangle
                {...props}
                radius={
                  lastSeriesKey(props.payload as WorkloadChartRow) === item.key
                    ? BAR_END_RADIUS
                    : 0
                }
              />
            )}
            isAnimationActive={!reducedMotion}
            className="cursor-pointer"
            // Read the row off the clicked bar: indexes skip empty segments.
            onClick={(bar) => {
              const row = (bar as { payload?: WorkloadChartRow }).payload
              if (row && row[item.key] > 0) onSelect(row, item.key)
            }}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

function lastSeriesKey(row: WorkloadChartRow | undefined) {
  if (!row) return undefined
  return WORKLOAD_SERIES.filter((series) => row[series.key] > 0).at(-1)?.key
}

// Same chrome as ChartTooltipContent, plus the row's open total.
function WorkloadTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: unknown }>
}) {
  const row = payload?.[0]?.payload as WorkloadChartRow | undefined
  if (!active || !row) return null

  return (
    <div className="grid min-w-44 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{row.label}</div>
      <div className="grid gap-1.5">
        {WORKLOAD_SERIES.map((item) => (
          <TooltipRow
            key={item.key}
            label={item.label}
            value={formatCount(row[item.key])}
            swatchClassName={item.swatchClassName}
          />
        ))}
      </div>
      <div className="grid gap-1.5 border-t border-border/50 pt-1.5">
        <TooltipRow label="Open" value={formatCount(row.open)} />
      </div>
    </div>
  )
}

function TooltipRow({
  label,
  value,
  swatchClassName,
}: {
  label: string
  value: string
  swatchClassName?: string
}) {
  return (
    <div className="flex items-center gap-2">
      {swatchClassName ? (
        <div
          className={cn('size-2.5 shrink-0 rounded-[2px]', swatchClassName)}
        />
      ) : null}
      <div className="flex flex-1 items-center justify-between gap-4 leading-none">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-foreground tabular-nums">
          {value}
        </span>
      </div>
    </div>
  )
}
