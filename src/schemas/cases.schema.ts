import { z } from 'zod'

// ─── Case Status Enum ───────────────────────────────────────────────────────

export const CASE_STATUSES = [
  'new',
  'working',
  'pending',
  'qc',
  'error',
  'closed',
  'awaiting_client',
] as const

export type CaseStatus = (typeof CASE_STATUSES)[number]

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  new: 'New',
  working: 'Working',
  pending: 'Pending',
  qc: 'QC',
  error: 'Error',
  closed: 'Closed',
  awaiting_client: 'Awaiting Client',
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
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  limit: z.number(),
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
  createdAtFrom: z.string().optional().transform(normalizeOptionalString),
  createdAtTo: z.string().optional().transform(normalizeOptionalString),
})

export type CaseFilters = z.infer<typeof caseFiltersSchema>

// ─── Stage Category ─────────────────────────────────────────────────────────

export const STAGE_CATEGORIES = ['new', 'in_progress', 'qc', 'error', 'closed'] as const
export type StageCategory = (typeof STAGE_CATEGORIES)[number]

// ─── Queue Stage ────────────────────────────────────────────────────────────

export const queueStageSchema = z.object({
  id: z.string(),
  queueId: z.string(),
  name: z.string(),
  slug: z.string(),
  order: z.number(),
  category: z.enum(STAGE_CATEGORIES),
  createdAt: z.string(),
})

export type QueueStage = z.infer<typeof queueStageSchema>

// ─── Field Review ───────────────────────────────────────────────────────────

export const FIELD_REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const
export type FieldReviewStatus = (typeof FIELD_REVIEW_STATUSES)[number]

export const fieldReviewSchema = z.object({
  id: z.string(),
  fieldName: z.string(),
  status: z.enum(FIELD_REVIEW_STATUSES),
  remarks: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  reviewedByName: z.string().nullable(),
  updatedAt: z.string().nullable(),
  resubmittedAt: z.string().nullable().optional(),
})

export type FieldReview = z.infer<typeof fieldReviewSchema>

// ─── Case Detail Response ───────────────────────────────────────────────────

export const CLOSE_OUTCOMES = ['successful', 'unsuccessful'] as const
export type CloseOutcome = (typeof CLOSE_OUTCOMES)[number]

export const caseDetailSchema = z.object({
  case: z.object({
    id: z.string(),
    caseNumber: z.string(),
    status: z.enum(CASE_STATUSES),
    priority: z.enum(['normal', 'high']),
    closeOutcome: z.enum(CLOSE_OUTCOMES).nullable(),
    closeReason: z.string().nullable(),
    closedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  currentStage: queueStageSchema.nullable(),
  stages: z.array(queueStageSchema),
  queue: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    qcEnabled: z.boolean(),
  }),
  merchant: z.record(z.string(), z.unknown()),
  documents: z.array(z.record(z.string(), z.unknown())),
  fieldReviews: z.array(fieldReviewSchema),
  latestResubmissionRequestedAt: z.string().nullable(),
  owner: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
})

export type CaseDetail = z.infer<typeof caseDetailSchema>

// ─── Case Comment ───────────────────────────────────────────────────────────

export const caseCommentSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  authorId: z.string(),
  authorName: z.string().nullable(),
  authorUsername: z.string().nullable(),
  content: z.string(),
  parentId: z.string().nullable(),
  mentions: z.array(z.string()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CaseComment = z.infer<typeof caseCommentSchema>

// ─── Case History ───────────────────────────────────────────────────────────

export const caseHistorySchema = z.object({
  id: z.string(),
  caseId: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  details: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
})

export type CaseHistory = z.infer<typeof caseHistorySchema>

// ─── Mutation Inputs ────────────────────────────────────────────────────────

export const saveFieldReviewsInputSchema = z.object({
  reviews: z.array(
    z.object({
      fieldName: z.string().min(1),
      status: z.enum(FIELD_REVIEW_STATUSES),
      remarks: z.string().optional(),
    }),
  ),
})

export type SaveFieldReviewsInput = z.infer<typeof saveFieldReviewsInputSchema>

export const closeUnsuccessfulInputSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
})

export type CloseUnsuccessfulInput = z.infer<typeof closeUnsuccessfulInputSchema>

export const createCommentInputSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty'),
  parentId: z.string().optional(),
  mentions: z.array(z.string()).optional(),
})

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>
