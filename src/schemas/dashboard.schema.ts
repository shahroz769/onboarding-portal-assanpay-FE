import { z } from 'zod'

import { CASE_STATUSES } from './cases.schema'
import { MERCHANT_STATUSES } from './merchants.schema'

// ─── Route Search ───────────────────────────────────────────────────────────

export const DASHBOARD_RANGES = [
  'today',
  '7d',
  '30d',
  '90d',
  'mtd',
  'custom',
] as const

export type DashboardRange = (typeof DASHBOARD_RANGES)[number]

export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  mtd: 'Month to date',
  custom: 'Custom',
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const dashboardRouteSearchSchema = z.object({
  range: z.enum(DASHBOARD_RANGES).catch('30d').default('30d'),
  from: z.string().optional().transform(normalizeOptionalString),
  to: z.string().optional().transform(normalizeOptionalString),
})

export type DashboardRouteSearch = z.infer<typeof dashboardRouteSearchSchema>

// ─── Response ───────────────────────────────────────────────────────────────

const pendingPortalMidLimitSchema = z.object({
  merchantId: z.string(),
  merchantName: z.string(),
  subMerchantName: z.string().nullable(),
  caseId: z.string(),
  caseNumber: z.string(),
  portalMid: z.number(),
  midKind: z.enum(['portal', 'internal']),
  savedAt: z.string(),
})

export type DashboardPendingPortalMidLimit = z.infer<
  typeof pendingPortalMidLimitSchema
>

const appliedPortalMidLimitSchema = z.object({
  portalMid: z.number(),
  merchantId: z.string().nullable(),
  appliedByName: z.string().nullable(),
  appliedAt: z.string(),
  category: z.enum(['custom_wordpress', 'shopify', 'internal']),
})

export type DashboardAppliedPortalMidLimit = z.infer<
  typeof appliedPortalMidLimitSchema
>

export const dashboardResponseSchema = z.object({
  range: z.object({
    key: z.enum(DASHBOARD_RANGES),
    from: z.string(),
    to: z.string(),
    label: z.string(),
  }),
  cases: z.object({
    total: z.number(),
    open: z.number(),
    new: z.number(),
    working: z.number(),
    pending: z.number(),
    qc: z.number(),
    error: z.number(),
    closed: z.number(),
    awaitingClient: z.number(),
    newInRange: z.number(),
    closedInRange: z.number(),
    slaBreached: z.number(),
    slaEvaluated: z.number(),
    openOverSla: z.number(),
    breachRate: z.number(),
    statusDistribution: z.array(
      z.object({ status: z.enum(CASE_STATUSES), count: z.number() }),
    ),
  }),
  merchants: z.object({
    total: z.number(),
    pending: z.number(),
    testing: z.number(),
    live: z.number(),
    terminated: z.number(),
    submittedInRange: z.number(),
    liveInRange: z.number(),
    funnel: z.array(
      z.object({ status: z.enum(MERCHANT_STATUSES), count: z.number() }),
    ),
  }),
  trends: z.object({
    submissions: z.array(z.object({ date: z.string(), count: z.number() })),
    caseFlow: z.array(
      z.object({
        date: z.string(),
        new: z.number(),
        closed: z.number(),
      }),
    ),
    merchantsLive: z.array(z.object({ date: z.string(), count: z.number() })),
  }),
  portalMids: z.object({
    pendingLimits: z.array(pendingPortalMidLimitSchema),
    appliedLimits: z.array(appliedPortalMidLimitSchema),
    csv: z.string(),
    appliedCsv: z.string(),
  }),
})

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>

const applyPortalMidLimitsInputSchema = z.object({
  portalMids: z.array(z.number().int().positive()).min(1),
  category: z.enum(['custom_wordpress', 'shopify', 'internal']),
})

export type ApplyPortalMidLimitsInput = z.infer<
  typeof applyPortalMidLimitsInputSchema
>

export const applyPortalMidLimitsResponseSchema = z.object({
  applied: z.array(z.number()),
  alreadyApplied: z.array(z.number()),
  notFound: z.array(z.number()),
})

export type ApplyPortalMidLimitsResponse = z.infer<
  typeof applyPortalMidLimitsResponseSchema
>
