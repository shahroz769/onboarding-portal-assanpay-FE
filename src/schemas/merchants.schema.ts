import { z } from 'zod'

// ─── Enum Constants with Labels ─────────────────────────────────────────────

export const ONBOARDING_STAGES = [
  'form_submitted',
  'documents_review',
  'sub_merchant',
  'agreement',
  'testing',
  'live',
  'suspended',
] as const

export type OnboardingStage = (typeof ONBOARDING_STAGES)[number]

export const ONBOARDING_STAGE_LABELS: Record<OnboardingStage, string> = {
  form_submitted: 'Form Submitted',
  documents_review: 'Documents Review',
  sub_merchant: 'Sub Merchant',
  agreement: 'Agreement',
  testing: 'Testing',
  live: 'Live',
  suspended: 'Suspended',
}

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

export const MERCHANT_STATUS_DISPLAY = {
  form_submitted: 'Pending',
  documents_review: 'In Progress',
  sub_merchant: 'In Progress',
  agreement: 'In Progress',
  testing: 'In Progress',
  live: 'Completed',
  suspended: 'Suspended',
} as const satisfies Record<OnboardingStage, string>

export type MerchantStatusDisplay =
  (typeof MERCHANT_STATUS_DISPLAY)[OnboardingStage]

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const merchantListItemSchema = z.object({
  id: z.string(),
  merchantNumber: z.number(),
  businessName: z.string(),
  onboardingStage: z.enum(ONBOARDING_STAGES),
  status: z.enum(ONBOARDING_STAGES),
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
  totalCount: z.number(),
})

export type MerchantListResponse = z.infer<typeof merchantListResponseSchema>

export const merchantFiltersSchema = z.object({
  search: z.string().optional(),
  onboardingStage: z.string().optional(),
  priority: z.string().optional(),
  currency: z.string().optional(),
  businessScope: z.string().optional(),
  createdAtFrom: z.string().optional(),
  createdAtTo: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export type MerchantFilters = z.infer<typeof merchantFiltersSchema>
