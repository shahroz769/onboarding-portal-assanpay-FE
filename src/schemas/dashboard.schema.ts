import * as z from 'zod'

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

// Mirrors the API limit: trend charts plot at most this many days.
export const MAX_DASHBOARD_RANGE_DAYS = 120

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

export const appliedPortalMidsSchema = z.object({
  customWordpress: z.array(z.number()),
  shopify: z.array(z.number()),
  internal: z.array(z.number()),
  // Every applied MID, in MID order.
  csv: z.string(),
})

export type AppliedPortalMids = z.infer<typeof appliedPortalMidsSchema>

const pendingPortalMidCountsSchema = z.object({
  total: z.number(),
  portal: z.number(),
  internal: z.number(),
})

export const pendingPortalMidsPageSchema = z.object({
  data: z.array(pendingPortalMidLimitSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  limit: z.number(),
  // Only sent with the first page.
  counts: pendingPortalMidCountsSchema.nullable(),
})

export type PendingPortalMidsPage = z.infer<typeof pendingPortalMidsPageSchema>

export const pendingPortalMidValuesSchema = z.object({
  mids: z.array(z.number()),
  csv: z.string(),
})

export type PendingPortalMidKind = DashboardPendingPortalMidLimit['midKind']

const awaitingPhysicalAgreementSchema = z.object({
  caseId: z.string(),
  caseNumber: z.string(),
  merchantId: z.string(),
  merchantName: z.string(),
  emailRecipient: z.string().nullable(),
  ownerName: z.string().nullable(),
  emailSentAt: z.string(),
})

export type AwaitingPhysicalAgreement = z.infer<
  typeof awaitingPhysicalAgreementSchema
>

export const awaitingPhysicalAgreementsPageSchema = z.object({
  data: z.array(awaitingPhysicalAgreementSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  limit: z.number(),
  // Only sent with the first page.
  total: z.number().nullable(),
})

export type AwaitingPhysicalAgreementsPage = z.infer<
  typeof awaitingPhysicalAgreementsPageSchema
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
    closed: z.number(),
    awaitingMerchant: z.number(),
    newInRange: z.number(),
    closedInRange: z.number(),
    slaBreached: z.number(),
    slaEvaluated: z.number(),
    openOverSla: z.number(),
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

// ─── Case Workload ──────────────────────────────────────────────────────────

const caseWorkloadCellSchema = z.object({
  queueId: z.string(),
  // null = the queue's unassigned pool.
  ownerId: z.string().nullable(),
  new: z.number(),
  working: z.number(),
  awaitingMerchant: z.number(),
})

export type CaseWorkloadCell = z.infer<typeof caseWorkloadCellSchema>

export const caseWorkloadResponseSchema = z.object({
  queues: z.array(z.object({ id: z.string(), name: z.string() })),
  members: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.enum(['active', 'inactive']),
    }),
  ),
  cells: z.array(caseWorkloadCellSchema),
})

export type CaseWorkloadResponse = z.infer<typeof caseWorkloadResponseSchema>
