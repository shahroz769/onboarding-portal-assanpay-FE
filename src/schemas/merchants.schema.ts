import { z } from 'zod'
import { paymentMethodSettingsSchema } from './configuration.schema'

// ─── Enum Constants with Labels ─────────────────────────────────────────────

export const MERCHANT_STATUSES = [
  'pending',
  'testing',
  'live',
  'terminated',
] as const
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number]

export const PRIORITIES = ['normal', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Record<Priority, string> = {
  normal: 'Normal',
  high: 'High',
}

export const BUSINESS_SCOPES = ['local', 'international'] as const
export type BusinessScope = (typeof BUSINESS_SCOPES)[number]

export const BUSINESS_SCOPE_LABELS: Record<BusinessScope, string> = {
  local: 'Local',
  international: 'International',
}

export const MERCHANT_STATUS_DISPLAY: Record<MerchantStatus, string> = {
  pending: 'Pending',
  testing: 'Testing',
  live: 'Live',
  terminated: 'Terminated',
}

export type MerchantStatusDisplay =
  (typeof MERCHANT_STATUS_DISPLAY)[MerchantStatus]

export const MERCHANT_SORTABLE_COLUMNS = [
  'merchantNumber',
  'businessName',
  'status',
  'priority',
  'createdAt',
  'businessScope',
] as const

export type MerchantSortableColumn = (typeof MERCHANT_SORTABLE_COLUMNS)[number]

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const merchantListItemSchema = z.object({
  id: z.string(),
  merchantNumber: z.number(),
  businessName: z.string(),
  status: z.enum(MERCHANT_STATUSES),
  priority: z.enum(PRIORITIES),
  priorityNote: z.string().nullable(),
  createdAt: z.string(),
  currency: z.string(),
  businessScope: z.enum(BUSINESS_SCOPES),
  liveAt: z.string().nullable(),
})

export type MerchantListItem = z.infer<typeof merchantListItemSchema>

export const merchantListResponseSchema = z.object({
  merchants: z.array(merchantListItemSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  limit: z.number(),
})

export type MerchantListResponse = z.infer<typeof merchantListResponseSchema>

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

export const merchantRouteSearchSchema = z.object({
  search: z.string().optional().transform(normalizeOptionalString),
  priority: createCsvEnumFilterSchema(PRIORITIES),
  businessScope: createCsvEnumFilterSchema(BUSINESS_SCOPES),
  currency: z.string().optional().transform(normalizeOptionalString),
  sortBy: z
    .enum(MERCHANT_SORTABLE_COLUMNS)
    .catch('merchantNumber')
    .default('merchantNumber'),
  sortOrder: z.enum(['asc', 'desc']).catch('desc').default('desc'),
})

export type MerchantRouteSearch = z.infer<typeof merchantRouteSearchSchema>

export const merchantFiltersSchema = merchantRouteSearchSchema.extend({
  createdAtFrom: z.string().optional().transform(normalizeOptionalString),
  createdAtTo: z.string().optional().transform(normalizeOptionalString),
})

export type MerchantFilters = z.infer<typeof merchantFiltersSchema>

// ─── Merchant Detail ────────────────────────────────────────────────────────

export const merchantDetailRecordSchema = z.object({
  id: z.string(),
  merchantNumber: z.number(),
  submitterEmail: z.string(),
  ownerFullName: z.string(),
  ownerPhone: z.string(),
  activeWhatsappNumber: z.string().nullable(),
  businessName: z.string(),
  businessPhone: z.string(),
  businessEmail: z.string(),
  businessAddress: z.string(),
  businessWebsite: z.string(),
  websiteCms: z.string(),
  businessDescription: z.string(),
  businessRegistrationDate: z.string(),
  businessNature: z.string(),
  merchantType: z.string(),
  estimatedMonthlyTransactions: z.number(),
  estimatedMonthlyVolume: z.string(),
  accountTitle: z.string(),
  bankName: z.string(),
  branchName: z.string(),
  accountNumberIban: z.string(),
  swiftCode: z.string().nullable(),
  nextOfKinRelation: z.string(),
  status: z.enum(MERCHANT_STATUSES),
  priority: z.enum(PRIORITIES),
  priorityNote: z.string().nullable(),
  businessScope: z.enum(BUSINESS_SCOPES),
  currency: z.string(),
  liveAt: z.string().nullable(),
  submittedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type MerchantDetailRecord = z.infer<typeof merchantDetailRecordSchema>

export const merchantDocumentSchema = z.object({
  id: z.string(),
  documentType: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  status: z.enum(['pending', 'approved', 'rejected']),
  googleDriveWebViewLink: z.string(),
  googleDriveDownloadLink: z.string().nullable(),
  createdAt: z.string(),
})

export type MerchantDocument = z.infer<typeof merchantDocumentSchema>

const merchantAgreementFileSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  caseNumber: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  googleDriveWebViewLink: z.string(),
  googleDriveDownloadLink: z.string().nullable(),
  createdAt: z.string(),
})

export type MerchantAgreementFile = z.infer<typeof merchantAgreementFileSchema>

export const merchantCaseSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  queueId: z.string(),
  queueName: z.string(),
  queueSlaHours: z.number().nullable(),
  stageName: z.string().nullable(),
  stageCategory: z.string().nullable(),
  status: z.string(),
  priority: z.enum(PRIORITIES),
  closeOutcome: z.string().nullable(),
  closeReason: z.string().nullable(),
  slaBreached: z.boolean(),
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type MerchantCase = z.infer<typeof merchantCaseSchema>

export const merchantTimelineEventSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  caseNumber: z.string(),
  queueName: z.string(),
  action: z.string(),
  details: z.unknown().nullable(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  createdAt: z.string(),
})

export type MerchantTimelineEvent = z.infer<typeof merchantTimelineEventSchema>

const limitRangeSchema = z.object({
  collectionMin: z.number(),
  collectionMax: z.number(),
  disbursementMin: z.number(),
  disbursementMax: z.number(),
})

export const merchantLimitsMdrSchema = z.object({
  testing: limitRangeSchema,
  live: limitRangeSchema,
  rates: z.object({
    eWallets: z.number(),
    cardDefault: z.number(),
    cardShopify: z.number(),
    payout: z.number(),
  }),
})

export type MerchantLimitsMdr = z.infer<typeof merchantLimitsMdrSchema>

export const merchantDetailResponseSchema = z.object({
  merchant: merchantDetailRecordSchema.extend({
    limitsMdrOverride: merchantLimitsMdrSchema.nullable(),
  }),
  documents: z.array(merchantDocumentSchema),
  agreements: z
    .object({
      clientSignedAgreement: merchantAgreementFileSchema.nullable(),
      physicalAgreement: merchantAgreementFileSchema.nullable(),
    })
    .default({
      clientSignedAgreement: null,
      physicalAgreement: null,
    }),
  cases: z.array(merchantCaseSchema),
  timeline: z.array(merchantTimelineEventSchema),
  milestones: z.object({
    formFilledAt: z.string().nullable(),
    testStartedAt: z.string().nullable(),
    liveAt: z.string().nullable(),
  }),
  limitsAndMdr: z.object({
    effective: merchantLimitsMdrSchema,
    override: merchantLimitsMdrSchema.nullable(),
    global: merchantLimitsMdrSchema,
    isOverridden: z.boolean(),
  }),
  paymentMethods: paymentMethodSettingsSchema,
  payoutMethods: paymentMethodSettingsSchema,
})

export type MerchantDetailResponse = z.infer<
  typeof merchantDetailResponseSchema
>
