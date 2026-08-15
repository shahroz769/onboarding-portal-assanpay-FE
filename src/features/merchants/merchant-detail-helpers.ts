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

export { caseStatusBadgeClasses } from '#/lib/status-styles'

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
