import { z } from 'zod'

// ─── Case Status Enum ───────────────────────────────────────────────────────

export const CASE_STATUSES = [
  'new',
  'working',
  'pending',
  'qc',
  'closed',
] as const

export type CaseStatus = (typeof CASE_STATUSES)[number]

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  new: 'New',
  working: 'Working',
  pending: 'Pending',
  qc: 'QC',
  closed: 'Closed',
}

export const CASE_SORTABLE_COLUMNS = [
  'caseNumber',
  'status',
  'createdAt',
  'closedAt',
  'updatedAt',
  'merchantName',
] as const

export type CaseSortableColumn = (typeof CASE_SORTABLE_COLUMNS)[number]

// ─── Case Owner ─────────────────────────────────────────────────────────────

export interface CaseOwner {
  id: string
  name: string
}

// ─── Queue Schema ───────────────────────────────────────────────────────────

export const queueSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  prefix: z.string(),
  createdAt: z.string(),
})

export type Queue = z.infer<typeof queueSchema>

// ─── Case List Item Schema ──────────────────────────────────────────────────

export const caseListItemSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  queueId: z.string(),
  queueName: z.string(),
  merchantId: z.string(),
  merchantName: z.string(),
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
  status: z.enum(CASE_STATUSES),
  priority: z.enum(['normal', 'high']),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CaseListItem = z.infer<typeof caseListItemSchema>

export const caseListResponseSchema = z.object({
  cases: z.array(caseListItemSchema),
  page: z.number(),
  perPage: z.number(),
  totalCount: z.number(),
  totalPages: z.number(),
})

export type CaseListResponse = z.infer<typeof caseListResponseSchema>

// ─── Route Search Params ────────────────────────────────────────────────────

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function createCsvEnumFilterSchema<const TValues extends readonly string[]>(
  values: TValues,
) {
  const allowedValues = new Set(values)

  return z
    .string()
    .optional()
    .transform(normalizeOptionalString)
    .refine(
      (value) =>
        value === undefined ||
        value.split(',').every((item) => allowedValues.has(item)),
      {
        message: 'Invalid filter value.',
      },
    )
}

export const caseRouteSearchSchema = z.object({
  search: z.string().optional().transform(normalizeOptionalString),
  queueId: z.string().optional().transform(normalizeOptionalString),
  ownerId: z.string().optional().transform(normalizeOptionalString),
  status: createCsvEnumFilterSchema(CASE_STATUSES),
  sortBy: z
    .enum(CASE_SORTABLE_COLUMNS)
    .catch('createdAt')
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).catch('desc').default('desc'),
})

export type CaseRouteSearch = z.infer<typeof caseRouteSearchSchema>

export const caseFiltersSchema = caseRouteSearchSchema.extend({
  page: z.number().int().positive().optional(),
  perPage: z.number().int().positive().optional(),
  createdAtFrom: z.string().optional().transform(normalizeOptionalString),
  createdAtTo: z.string().optional().transform(normalizeOptionalString),
})

export type CaseFilters = z.infer<typeof caseFiltersSchema>
