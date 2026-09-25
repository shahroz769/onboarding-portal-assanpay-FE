// ─── Status color system ────────────────────────────────────────────────────
// Single source of truth for status / priority / SLA tint classes across
// every surface (cases tables, merchant views, case-detail stage strip).
// Badge chrome (padding, radius, borders) stays in the Badge component;
// these classes carry color only.

const TINTS = {
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
  orange:
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  purple:
    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  violet:
    'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rose: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
  indigo:
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  emerald:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  neutral: 'bg-muted text-muted-foreground',
} as const

export type StatusTint = keyof typeof TINTS

export function statusTint(tint: StatusTint): string {
  return TINTS[tint]
}

// Text-only variants — the foreground half of TINTS, for accents (e.g. a
// `bg-current` indicator bar) that should match a tinted label's color.
const TEXT_TINTS: Record<StatusTint, string> = {
  blue: 'text-blue-800 dark:text-blue-300',
  amber: 'text-amber-800 dark:text-amber-300',
  sky: 'text-sky-800 dark:text-sky-300',
  orange: 'text-orange-800 dark:text-orange-300',
  purple: 'text-purple-800 dark:text-purple-300',
  violet: 'text-violet-800 dark:text-violet-300',
  teal: 'text-teal-800 dark:text-teal-300',
  green: 'text-green-800 dark:text-green-300',
  rose: 'text-rose-800 dark:text-rose-300',
  indigo: 'text-indigo-800 dark:text-indigo-300',
  cyan: 'text-cyan-800 dark:text-cyan-300',
  red: 'text-red-800 dark:text-red-300',
  emerald: 'text-emerald-800 dark:text-emerald-300',
  neutral: 'text-muted-foreground',
}

export function statusTintText(tint: StatusTint): string {
  return TEXT_TINTS[tint]
}

// Deepened variants — for elements that sit ON a tinted surface (e.g. the
// number chip inside a tinted nav pill), where a tint-on-tint look washes
// out. One step deeper in the same hue, not a solid block.
const DEEP_TINTS: Record<StatusTint, string> = {
  blue: 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100',
  amber: 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100',
  sky: 'bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100',
  orange:
    'bg-orange-200 text-orange-900 dark:bg-orange-800 dark:text-orange-100',
  purple:
    'bg-purple-200 text-purple-900 dark:bg-purple-800 dark:text-purple-100',
  violet:
    'bg-violet-200 text-violet-900 dark:bg-violet-800 dark:text-violet-100',
  teal: 'bg-teal-200 text-teal-900 dark:bg-teal-800 dark:text-teal-100',
  green: 'bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100',
  rose: 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100',
  indigo:
    'bg-indigo-200 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100',
  cyan: 'bg-cyan-200 text-cyan-900 dark:bg-cyan-800 dark:text-cyan-100',
  red: 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100',
  emerald:
    'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100',
  neutral: 'bg-muted-foreground/15 text-muted-foreground',
}

export function statusTintDeep(tint: StatusTint): string {
  return DEEP_TINTS[tint]
}

// ─── Case status ────────────────────────────────────────────────────────────

// 'plain' = the untinted secondary badge (same look as the Normal priority).
const CASE_STATUS_TINTS: Record<string, StatusTint | 'plain'> = {
  new: 'blue',
  working: 'amber',
  awaiting_client: 'sky',
  pending: 'orange',
  qc: 'purple',
  error: 'red',
  closed: 'plain',
}

export function caseStatusBadgeClasses(
  status: string,
  closeOutcome?: string | null,
): string {
  if (status === 'closed' && closeOutcome === 'unsuccessful') {
    return TINTS.red
  }
  const tint = CASE_STATUS_TINTS[status] ?? 'neutral'
  return tint === 'plain' ? '' : TINTS[tint]
}

// ─── Merchant status ────────────────────────────────────────────────────────

const MERCHANT_STATUS_TINTS: Record<string, StatusTint> = {
  pending: 'amber',
  testing: 'sky',
  live: 'emerald',
  terminated: 'red',
}

export function merchantStatusBadgeClasses(status: string): string {
  return TINTS[MERCHANT_STATUS_TINTS[status] ?? 'neutral']
}

// ─── Priority ───────────────────────────────────────────────────────────────

// Normal priority renders as the default neutral secondary badge.
export function priorityBadgeClasses(priority: string): string {
  return priority === 'high' ? TINTS.orange : ''
}

// ─── SLA ────────────────────────────────────────────────────────────────────

export function slaBadgeClasses(isBreached: boolean): string {
  return isBreached ? TINTS.red : ''
}

// ─── Interactive badge affordance ───────────────────────────────────────────
// Badges that act as buttons (e.g. admin priority editing) must look
// clickable: cursor + hover ring, matching the focus-ring token.
export const CLICKABLE_BADGE_CLASSES =
  'cursor-pointer transition-shadow hover:ring-2 hover:ring-ring/60'
