import { endOfWeek, format, startOfWeek } from 'date-fns'

import type { ChartConfig } from '#/components/ui/chart'

const numberFormatter = new Intl.NumberFormat('en-US')

export function formatCount(value: number) {
  return numberFormatter.format(value)
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

// ─── Chart palette ──────────────────────────────────────────────────────────
// Badge hues from status-styles.ts: solid bars in the badge's mid tone
// (`count`). Submissions start new cases, so
// they use the New badge's blue; merchants going live use a muted teal.

export const submissionsChartConfig = {
  count: {
    label: 'Submissions',
    theme: { light: 'var(--color-blue-300)', dark: 'var(--color-blue-800)' },
  },
} satisfies ChartConfig

export const merchantsLiveChartConfig = {
  count: {
    label: 'Went live',
    theme: {
      light: 'oklch(0.81 0.08 180)',
      dark: 'oklch(0.45 0.07 180)',
    },
  },
} satisfies ChartConfig

// Shared by DashboardCharts and its skeleton so the static header text (and
// therefore the header height) is identical while recharts loads.
export const DASHBOARD_CHARTS = [
  {
    key: 'submissions',
    title: 'Form submissions',
    description: 'Daily merchant form submissions',
    config: submissionsChartConfig,
  },
  {
    key: 'merchantsLive',
    title: 'Merchants live',
    description: 'Daily merchants that went live',
    config: merchantsLiveChartConfig,
  },
] as const
