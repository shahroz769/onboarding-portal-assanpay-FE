import { z } from 'zod'
import { paymentMethodSettingsSchema } from './configuration.schema'
import { QUEUE_LIFECYCLES, QUEUE_WORKFLOW_TYPES } from './queue-workflow.schema'

export {
  QUEUE_LIFECYCLES,
  QUEUE_WORKFLOW_TYPES,
  type QueueLifecycle,
  type QueueWorkflowType,
} from './queue-workflow.schema'

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

export const MERCHANT_PORTAL_ROLES = [
  'merchant_admin',
  'international_merchant_admin',
] as const

export type MerchantPortalRole = (typeof MERCHANT_PORTAL_ROLES)[number]

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

const queueSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  prefix: z.string(),
  workflowType: z.enum(QUEUE_WORKFLOW_TYPES).optional().default('generic'),
  lifecycle: z.enum(QUEUE_LIFECYCLES).optional(),
  revision: z.number().optional(),
  qcEnabled: z.boolean().optional(),
  slaHours: z.number().optional(),
  isActive: z.boolean().optional(),
  createdAt: z.string(),
})

export type Queue = z.infer<typeof queueSchema>

export const CLOSE_OUTCOMES = ['successful', 'unsuccessful'] as const
export type CloseOutcome = (typeof CLOSE_OUTCOMES)[number]

// ─── Case List Item Schema ──────────────────────────────────────────────────

export const caseListItemSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  queueId: z.string(),
  queueName: z.string(),
  queueSlaHours: z.number().nullable().optional(),
  slaBreached: z.boolean().nullable().optional(),
  merchantId: z.string(),
  merchantName: z.string(),
  subMerchantName: z.string().nullable(),
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
  status: z.enum(CASE_STATUSES),
  priority: z.enum(['normal', 'high']),
  closeOutcome: z.enum(CLOSE_OUTCOMES).nullable(),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CaseListItem = z.infer<typeof caseListItemSchema>

const caseListResponseSchema = z.object({
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
  sortBy: z.enum(CASE_SORTABLE_COLUMNS).catch('createdAt').default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).catch('desc').default('desc'),
})

export type CaseRouteSearch = z.infer<typeof caseRouteSearchSchema>

const caseFiltersSchema = caseRouteSearchSchema.extend({
  createdAtFrom: z.string().optional().transform(normalizeOptionalString),
  createdAtTo: z.string().optional().transform(normalizeOptionalString),
})

export type CaseFilters = z.infer<typeof caseFiltersSchema>

// ─── Stage Category ─────────────────────────────────────────────────────────

export const STAGE_CATEGORIES = [
  'new',
  'in_progress',
  'qc',
  'error',
  'closed',
] as const
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

export const FIELD_REVIEW_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const
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

const caseDetailSchema = z.object({
  case: z.object({
    id: z.string(),
    caseNumber: z.string(),
    status: z.enum(CASE_STATUSES),
    priority: z.enum(['normal', 'high']),
    closeOutcome: z.enum(CLOSE_OUTCOMES).nullable(),
    slaBreached: z.boolean().nullable().optional(),
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
    workflowType: z.enum(QUEUE_WORKFLOW_TYPES).optional().default('generic'),
    lifecycle: z.enum(QUEUE_LIFECYCLES).optional(),
    qcEnabled: z.boolean(),
    slaHours: z.number().nullable().optional(),
  }),
  merchant: z.record(z.string(), z.unknown()),
  documents: z.array(z.record(z.string(), z.unknown())),
  fieldReviews: z.array(fieldReviewSchema),
  subMerchantForm: z
    .object({
      subMerchantKey: z.string(),
      subMerchantName: z.string(),
      sellerCode: z.string().nullable(),
      draftUrl: z.string(),
      emailStatus: z.enum(['not_sent', 'sent', 'failed']),
      emailLogId: z.string().nullable(),
      emailSentAt: z.string().nullable(),
      emailRecipient: z.string().nullable(),
      finalForm: z
        .object({
          id: z.string(),
          originalName: z.string(),
          mimeType: z.string(),
          sizeBytes: z.number(),
          googleDriveWebViewLink: z.string(),
          googleDriveDownloadLink: z.string().nullable(),
          createdAt: z.string(),
        })
        .nullable(),
      emailProof: z
        .object({
          id: z.string(),
          originalName: z.string(),
          mimeType: z.string(),
          sizeBytes: z.number(),
          googleDriveWebViewLink: z.string(),
          googleDriveDownloadLink: z.string().nullable(),
          createdAt: z.string(),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  documentReview: z
    .object({
      subMerchants: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        }),
      ),
      selectedAt: z.string(),
      selectedBy: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  agreement: z
    .object({
      businessType: z.string(),
      draftKey: z.string(),
      draftLabel: z.string(),
      draftUrl: z.string(),
      emailStatus: z.enum(['not_sent', 'sent', 'failed']),
      emailLogId: z.string().nullable(),
      emailSentAt: z.string().nullable(),
      emailRecipient: z.string().nullable(),
      lastRejectionRemarks: z.string().nullable(),
      finalAgreement: z
        .object({
          id: z.string(),
          originalName: z.string(),
          mimeType: z.string(),
          sizeBytes: z.number(),
          googleDriveWebViewLink: z.string(),
          googleDriveDownloadLink: z.string().nullable(),
          createdAt: z.string(),
        })
        .nullable(),
      clientAgreement: z
        .object({
          id: z.string(),
          originalName: z.string(),
          mimeType: z.string(),
          sizeBytes: z.number(),
          googleDriveWebViewLink: z.string(),
          googleDriveDownloadLink: z.string().nullable(),
          createdAt: z.string(),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  physicalAgreement: z
    .object({
      id: z.string(),
      originalName: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number(),
      googleDriveWebViewLink: z.string(),
      googleDriveDownloadLink: z.string().nullable(),
      createdAt: z.string(),
    })
    .nullable()
    .optional(),
  latestResubmissionRequestedAt: z.string().nullable(),
  testing: z
    .object({
      limitsAppliedAt: z.string().nullable(),
      limitsAppliedBy: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .nullable(),
      portalMid: z.number().nullable().optional(),
      internalPortalMid: z.number().nullable().optional(),
      email: z.string().nullable().optional(),
      branchCode: z.string().nullable().optional(),
      internalEmail: z.string().nullable().optional(),
      internalBranchCode: z.string().nullable().optional(),
      internalLimitsAppliedAt: z.string().nullable().optional(),
      internalLimitsAppliedBy: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .nullable()
        .optional(),
      merchantRole: z.enum(MERCHANT_PORTAL_ROLES).nullable().optional(),
      credentialsReady: z.boolean().optional(),
      paymentMethods: paymentMethodSettingsSchema.nullable().optional(),
      payoutMethods: paymentMethodSettingsSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
  live: z
    .object({
      limitsAppliedAt: z.string().nullable(),
      limitsAppliedBy: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  wordpressWebsite: z
    .object({
      clonedWebsiteLink: z.string().nullable(),
      savedAt: z.string().nullable(),
      savedBy: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .nullable(),
      screenshots: z.array(
        z.object({
          id: z.string(),
          originalName: z.string(),
          mimeType: z.string(),
          sizeBytes: z.number(),
          googleDriveWebViewLink: z.string(),
          googleDriveDownloadLink: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
      subMerchantLogoScreenshots: z.array(
        z.object({
          id: z.string(),
          subMerchantId: z.string().nullable(),
          originalName: z.string(),
          mimeType: z.string(),
          sizeBytes: z.number(),
          googleDriveWebViewLink: z.string(),
          googleDriveDownloadLink: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
      assanpayCheckoutScreenshots: z.array(
        z.object({
          id: z.string(),
          originalName: z.string(),
          mimeType: z.string(),
          sizeBytes: z.number(),
          googleDriveWebViewLink: z.string(),
          googleDriveDownloadLink: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    })
    .nullable()
    .optional(),
  owner: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
})

export type CaseDetail = z.infer<typeof caseDetailSchema>

// ─── Case Comment ───────────────────────────────────────────────────────────

const caseCommentSchema = z.object({
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

const caseHistorySchema = z.object({
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

const saveFieldReviewsInputSchema = z.object({
  reviews: z.array(
    z.object({
      fieldName: z.string().min(1),
      status: z.enum(FIELD_REVIEW_STATUSES),
      remarks: z.string().optional(),
    }),
  ),
})

export type SaveFieldReviewsInput = z.infer<typeof saveFieldReviewsInputSchema>

const saveDocumentReviewSubMerchantInputSchema = z.object({
  subMerchantIds: z.array(z.uuid()).min(1).max(30),
})

export type SaveDocumentReviewSubMerchantInput = z.infer<
  typeof saveDocumentReviewSubMerchantInputSchema
>

const closeUnsuccessfulInputSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
})

export type CloseUnsuccessfulInput = z.infer<
  typeof closeUnsuccessfulInputSchema
>

const createCommentInputSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty'),
  parentId: z.string().optional(),
  mentions: z.array(z.string()).optional(),
})

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>

const selectSubMerchantFormInputSchema = z.object({
  subMerchantKey: z.string().min(1),
})

export type SelectSubMerchantFormInput = z.infer<
  typeof selectSubMerchantFormInputSchema
>

export type AgreementEmailResponse = {
  status: 'sent' | 'failed'
  emailLogId: string
  tokenExpiresAt: string | null
  error?: string
}

const saveMidCreationDetailsInputSchema = z.object({
  portalMid: z.coerce.number().int().positive(),
  internalPortalMid: z.coerce.number().int().positive(),
  email: z.string().trim().email(),
  branchCode: z.string().trim().min(1).max(100),
  internalEmail: z.string().trim().email(),
  internalBranchCode: z.string().trim().min(1).max(100),
  merchantRole: z.enum(MERCHANT_PORTAL_ROLES),
  paymentMethods: paymentMethodSettingsSchema.min(
    1,
    'Select at least one payment method.',
  ),
})

export type SaveMidCreationDetailsInput = z.infer<
  typeof saveMidCreationDetailsInputSchema
>

export type SaveMidCreationDetailsResponse = {
  portalMid: number
  internalPortalMid: number
  email: string
  branchCode: string
  internalEmail: string
  internalBranchCode: string
  merchantRole: MerchantPortalRole
  paymentMethods: z.infer<typeof paymentMethodSettingsSchema>
  payoutMethods: z.infer<typeof paymentMethodSettingsSchema>
  savedAt: string
}

export const emailRecipientTypeValues = ['submitter', 'business'] as const
export type EmailRecipientType = (typeof emailRecipientTypeValues)[number]

export const emailRecipientSelectionSchema = z.object({
  recipientEmailType: z.enum(emailRecipientTypeValues).default('submitter'),
})

export type EmailRecipientSelection = z.infer<
  typeof emailRecipientSelectionSchema
>

const sendMidCreationEmailInputSchema = emailRecipientSelectionSchema

export type SendMidCreationEmailInput = z.infer<
  typeof sendMidCreationEmailInputSchema
>

const sendLiveEmailInputSchema = emailRecipientSelectionSchema

export type SendLiveEmailInput = z.infer<typeof sendLiveEmailInputSchema>

export type MidCreationEmailResponse = {
  status: 'sent' | 'failed'
  emailLogId: string
  goLiveAvailableAt: string | null
  error?: string
}

const saveWordpressWebsiteInputSchema = z.object({
  clonedWebsiteLink: z.string().trim().url(),
})

export type SaveWordpressWebsiteInput = z.infer<
  typeof saveWordpressWebsiteInputSchema
>
