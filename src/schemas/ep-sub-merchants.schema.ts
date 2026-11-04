import * as z from 'zod'

import { MERCHANT_STATUSES, epCaseSummarySchema } from './merchants.schema'
import { searchParamSchema } from './search-param.schema'

// ─── Filters ────────────────────────────────────────────────────────────────

export const EP_PROGRESS_FILTERS = [
  'not_triggered',
  'open',
  'unsuccessful',
  'completed',
] as const

export const EP_PROGRESS_FILTER_LABELS: Record<
  (typeof EP_PROGRESS_FILTERS)[number],
  string
> = {
  not_triggered: 'Not Triggered',
  open: 'Triggered (Open)',
  unsuccessful: 'Closed Unsuccessful',
  completed: 'Closed Successful',
}

export const EP_WORDPRESS_FILTERS = ['successful', 'not_successful'] as const

export const EP_WORDPRESS_FILTER_LABELS: Record<
  (typeof EP_WORDPRESS_FILTERS)[number],
  string
> = {
  successful: 'Successful',
  not_successful: 'Not Successful',
}

export const EP_MERCHANT_STATUSES = MERCHANT_STATUSES.filter(
  (status) => status !== 'terminated',
)

/** In the URL, marks a filter the user turned off (no value means the default). */
export const EP_FILTER_ALL = 'all'

// The agent's work list: merchants that can be triggered or are in progress.
export const DEFAULT_EP_PROGRESS_FILTER = 'not_triggered,open,unsuccessful'
export const DEFAULT_EP_WORDPRESS_FILTER = 'successful'

export const EP_MERCHANT_SORTABLE_COLUMNS = [
  'createdAt',
  'merchantNumber',
  'businessName',
  'ownerFullName',
  'status',
  'updatedAt',
] as const

export type EpMerchantSortableColumn =
  (typeof EP_MERCHANT_SORTABLE_COLUMNS)[number]

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function csvFilterSchema(values: readonly string[]) {
  const allowedValues = new Set([...values, EP_FILTER_ALL])

  return z
    .string()
    .optional()
    .transform(normalizeOptionalString)
    .catch(undefined)
    .refine(
      (value) =>
        value === undefined ||
        value.split(',').every((item) => allowedValues.has(item)),
      { error: 'Invalid filter value.' },
    )
    .catch(undefined)
}

export const epMerchantRouteSearchSchema = z.object({
  search: searchParamSchema,
  status: csvFilterSchema(EP_MERCHANT_STATUSES),
  wordpress: csvFilterSchema(EP_WORDPRESS_FILTERS),
  progress: csvFilterSchema(EP_PROGRESS_FILTERS),
  // Oldest first, so the longest-waiting merchants are at the top.
  sortBy: z
    .enum(EP_MERCHANT_SORTABLE_COLUMNS)
    .catch('createdAt')
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).catch('asc').default('asc'),
})

export type EpMerchantRouteSearch = z.infer<typeof epMerchantRouteSearchSchema>

export type EpMerchantFilters = {
  search?: string
  status?: string
  wordpress?: string
  progress?: string
  sortBy: EpMerchantSortableColumn
  sortOrder: 'asc' | 'desc'
}

// ─── Responses ──────────────────────────────────────────────────────────────

const epSubMerchantSchema = z.object({
  id: z.string(),
  name: z.string(),
  canTrigger: z.boolean(),
  latestCase: epCaseSummarySchema.nullable(),
})

export type EpSubMerchant = z.infer<typeof epSubMerchantSchema>

const epMerchantSchema = z.object({
  id: z.string(),
  merchantNumber: z.number(),
  businessName: z.string(),
  ownerFullName: z.string(),
  status: z.enum(MERCHANT_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  wordpress: z
    .object({
      isSuccessful: z.boolean(),
      status: epCaseSummarySchema.shape.status,
      closeOutcome: epCaseSummarySchema.shape.closeOutcome,
    })
    .nullable(),
  isEligible: z.boolean(),
  subMerchants: z.array(epSubMerchantSchema),
  otherCases: z.array(epCaseSummarySchema),
})

export type EpMerchant = z.infer<typeof epMerchantSchema>

const epMerchantListResponseSchema = z.object({
  merchants: z.array(epMerchantSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  limit: z.number(),
  total: z.number().nullable().optional(),
})

export type EpMerchantListResponse = z.infer<
  typeof epMerchantListResponseSchema
>
