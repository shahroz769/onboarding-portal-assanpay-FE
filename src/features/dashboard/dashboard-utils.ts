import { endOfWeek, format, startOfWeek } from 'date-fns'

import type { ChartConfig } from '#/components/ui/chart'

const numberFormatter = new Intl.NumberFormat('en-US')

export function formatCount(value: number) {
  return numberFormatter.format(value)
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

export function formatDay(value: string) {
  return format(parseDateKey(value), 'MMM d')
}

export type DailyCountPoint = { date: string; count: number }

// Weeks start Monday; each point is keyed by its week-start date.
export function aggregateByWeek(data: DailyCountPoint[]): DailyCountPoint[] {
  const totals = new Map<string, number>()
  for (const day of data) {
    const weekStart = format(
      startOfWeek(parseDateKey(day.date), { weekStartsOn: 1 }),
      'yyyy-MM-dd',
    )
    totals.set(weekStart, (totals.get(weekStart) ?? 0) + day.count)
  }
  return Array.from(totals, ([date, count]) => ({ date, count }))
}

export function formatWeekRange(value: string) {
  const start = startOfWeek(parseDateKey(value), { weekStartsOn: 1 })
  const end = endOfWeek(start, { weekStartsOn: 1 })
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
}

// ─── Status colors (chart palette) ──────────────────────────────────────────

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return new Date(value)
  return new Date(year, month - 1, day)
}

// ─── Brand chart palette (rgb(74, 109, 101)) ────────────────────────────────

const BRAND_PRIMARY = {
  light: 'rgb(74, 109, 101)',
  dark: 'rgb(106, 174, 159)',
}

export const submissionsChartConfig = {
  count: { label: 'Submissions', theme: BRAND_PRIMARY },
} satisfies ChartConfig

export const merchantsLiveChartConfig = {
  count: { label: 'Went live', theme: BRAND_PRIMARY },
} satisfies ChartConfig
