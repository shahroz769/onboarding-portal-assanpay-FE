import { format, formatDistanceToNow } from 'date-fns'

import type { ChartConfig } from '#/components/ui/chart'
import type { CaseStatus } from '#/schemas/cases.schema'
import { CASE_STATUS_LABELS } from '#/schemas/cases.schema'
import type { MerchantStatus } from '#/schemas/merchants.schema'
import { MERCHANT_STATUS_DISPLAY } from '#/schemas/merchants.schema'

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

export function formatDateTime(value: string | null) {
  if (!value) return '—'
  return format(new Date(value), 'MMM d, yyyy h:mm a')
}

export function formatRelative(value: string | null) {
  if (!value) return '—'
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

// ─── Status colors (chart palette) ──────────────────────────────────────────

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return new Date(value)
  return new Date(year, month - 1, day)
}

export const CASE_STATUS_COLORS: Record<CaseStatus, string> = {
  new: 'var(--chart-1)',
  working: 'var(--chart-2)',
  pending: 'var(--chart-3)',
  qc: 'var(--chart-4)',
  awaiting_client: 'var(--chart-5)',
  error: 'var(--destructive)',
  closed: 'var(--muted-foreground)',
}

export const MERCHANT_STATUS_COLORS: Record<MerchantStatus, string> = {
  pending: 'var(--chart-3)',
  testing: 'var(--chart-1)',
  live: 'var(--chart-2)',
  terminated: 'var(--destructive)',
}

export const caseStatusChartConfig = Object.fromEntries(
  (Object.keys(CASE_STATUS_LABELS) as Array<CaseStatus>).map((status) => [
    status,
    { label: CASE_STATUS_LABELS[status], color: CASE_STATUS_COLORS[status] },
  ]),
) satisfies ChartConfig

export const merchantStatusChartConfig = Object.fromEntries(
  (Object.keys(MERCHANT_STATUS_DISPLAY) as Array<MerchantStatus>).map(
    (status) => [
      status,
      {
        label: MERCHANT_STATUS_DISPLAY[status],
        color: MERCHANT_STATUS_COLORS[status],
      },
    ],
  ),
) satisfies ChartConfig

export const caseFlowChartConfig = {
  new: { label: 'New', color: 'var(--chart-1)' },
  closed: { label: 'Closed', color: 'var(--chart-2)' },
} satisfies ChartConfig

export const queueStatusChartConfig = {
  new: { label: 'New', color: 'var(--chart-1)' },
  working: { label: 'Working', color: 'var(--chart-2)' },
  pending: { label: 'Pending', color: 'var(--chart-3)' },
  closed: { label: 'Closed', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

export const submissionsChartConfig = {
  count: { label: 'Submissions', color: 'var(--chart-1)' },
} satisfies ChartConfig
