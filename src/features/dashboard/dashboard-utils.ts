import { format } from 'date-fns'

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

// ─── Status colors (chart palette) ──────────────────────────────────────────

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return new Date(value)
  return new Date(year, month - 1, day)
}

export const caseFlowChartConfig = {
  new: { label: 'New', color: 'var(--chart-1)' },
  closed: { label: 'Closed', color: 'var(--chart-2)' },
} satisfies ChartConfig

export const submissionsChartConfig = {
  count: { label: 'Submissions', color: 'var(--chart-1)' },
} satisfies ChartConfig
