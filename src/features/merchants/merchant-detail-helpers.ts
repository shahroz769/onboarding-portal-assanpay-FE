import {
  DOCUMENT_LABELS,
  KIN_RELATIONS,
  MERCHANT_TYPES,
  WEBSITE_CMS_OPTIONS,
} from '#/schemas/merchant-onboarding.schema'

// ─── Label Maps ─────────────────────────────────────────────────────────────

const merchantTypeLabels = Object.fromEntries(
  MERCHANT_TYPES.map((option) => [option.value, option.label]),
) as Record<string, string>

const websiteCmsLabels = Object.fromEntries(
  WEBSITE_CMS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>

const kinRelationLabels = Object.fromEntries(
  KIN_RELATIONS.map((option) => [option.value, option.label]),
) as Record<string, string>
const documentLabels = DOCUMENT_LABELS as Record<string, string>

export function merchantTypeLabel(value: string) {
  return merchantTypeLabels[value] ?? humanize(value)
}

export function websiteCmsLabel(value: string) {
  return websiteCmsLabels[value] ?? humanize(value)
}

export function kinRelationLabel(value: string) {
  return kinRelationLabels[value] ?? humanize(value)
}

export function documentTypeLabel(value: string) {
  return documentLabels[value] ?? humanize(value)
}

// ─── Generic Humanizer ──────────────────────────────────────────────────────

export function humanize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

// ─── Badge Class Helpers ────────────────────────────────────────────────────

export function caseStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'new':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
    case 'working':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300'
    case 'pending':
    case 'awaiting_client':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
    case 'qc':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-300'
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300'
    case 'closed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

// ─── Open / Closed classification ───────────────────────────────────────────

export function isCaseOpen(status: string, stageCategory: string | null) {
  return status !== 'closed' && status !== 'error' && stageCategory !== 'closed'
}

// ─── Formatters ─────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 2,
})

export function formatCurrency(value: number | string, currency = 'PKR') {
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numeric)) return String(value)
  return `${currency} ${currencyFormatter.format(numeric)}`
}

export function formatNumber(value: number | string) {
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numeric)) return String(value)
  return currencyFormatter.format(numeric)
}
