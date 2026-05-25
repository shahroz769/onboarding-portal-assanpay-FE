import { z } from 'zod'

const limitRangeSchema = z.object({
  collectionMin: z.coerce.number().min(0),
  collectionMax: z.coerce.number().min(0),
  disbursementMin: z.coerce.number().min(0),
  disbursementMax: z.coerce.number().min(0),
})

export const limitsAndMdrSettingsSchema = z.object({
  testing: limitRangeSchema,
  live: limitRangeSchema,
  rates: z.object({
    eWallets: z.coerce.number().min(0).max(100),
    cardDefault: z.coerce.number().min(0).max(100),
    cardShopify: z.coerce.number().min(0).max(100),
    payout: z.coerce.number().min(0).max(100),
  }),
})

export const linkDeadlineSettingsSchema = z.object({
  passwordResetHours: z.coerce.number().int().min(1).max(8760).nullable(),
  newPasswordSetHours: z.coerce.number().int().min(1).max(8760).nullable(),
  agreementLinkHours: z.coerce.number().int().min(1).max(8760).nullable(),
  documentsReviewResubmissionHours: z.coerce.number().int().min(1).max(8760).nullable(),
  goLiveAvailabilityHours: z.coerce.number().int().min(1).max(8760).nullable(),
})

export const businessTypeOptionSchema = z.object({
  value: z.enum([
    'sole_proprietorship',
    'private_limited_company',
    'public_limited_company',
    'partnership',
    'limited_liability_partnership',
    'ngo_npo_charity',
    'trust_society_association',
  ]),
  label: z.string(),
})

export const agreementDraftSchema = z.object({
  businessType: z.enum([
    'sole_proprietorship',
    'private_limited_company',
    'public_limited_company',
    'partnership',
    'limited_liability_partnership',
    'ngo_npo_charity',
    'trust_society_association',
  ]),
  label: z.string(),
  originalName: z.string().nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  googleDriveWebViewLink: z.string().nullable(),
  googleDriveDownloadLink: z.string().nullable(),
  googleDriveFolderId: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export const subMerchantDraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  sellerCode: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  googleDriveWebViewLink: z.string(),
  googleDriveDownloadLink: z.string().nullable(),
  googleDriveFolderId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const caseFlowQueueSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  prefix: z.string(),
  isActive: z.boolean(),
})

export const caseFlowStartRuleSchema = z.object({
  id: z.string().optional(),
  targetQueueId: z.string(),
  order: z.number(),
  isActive: z.boolean(),
})

export const caseFlowCloseTriggerSchema = z.object({
  id: z.string().optional(),
  sourceQueueId: z.string(),
  targetQueueId: z.string(),
  order: z.number(),
  isActive: z.boolean(),
})

export const caseFlowCloseBlockerSchema = z.object({
  id: z.string().optional(),
  blockedQueueId: z.string(),
  prerequisiteQueueId: z.string(),
  isActive: z.boolean(),
})

export const caseFlowConfigurationSchema = z.object({
  queues: z.array(caseFlowQueueSchema),
  startRules: z.array(caseFlowStartRuleSchema),
  closeTriggers: z.array(caseFlowCloseTriggerSchema),
  closeBlockers: z.array(caseFlowCloseBlockerSchema),
})

export const emailSendingModeSchema = z
  .object({
    autoEnabled: z.boolean(),
    manualEnabled: z.boolean(),
  })
  .refine((v) => v.autoEnabled || v.manualEnabled, {
    message: 'At least one email sending mode must be enabled.',
    path: ['autoEnabled'],
  })

export const configurationOverviewSchema = z.object({
  limitsAndMdr: limitsAndMdrSettingsSchema,
  linkDeadlines: linkDeadlineSettingsSchema,
  emailSendingMode: emailSendingModeSchema,
  agreementDrafts: z.array(agreementDraftSchema),
  subMerchants: z.array(subMerchantDraftSchema),
  businessTypes: z.array(businessTypeOptionSchema),
})

export type LimitsAndMdrSettings = z.infer<typeof limitsAndMdrSettingsSchema>
export type LinkDeadlineSettings = z.infer<typeof linkDeadlineSettingsSchema>
export type EmailSendingMode = z.infer<typeof emailSendingModeSchema>
export type ConfigurationOverview = z.infer<typeof configurationOverviewSchema>
export type CaseFlowConfiguration = z.infer<typeof caseFlowConfigurationSchema>
export type CaseFlowStartRule = z.infer<typeof caseFlowStartRuleSchema>
export type CaseFlowCloseTrigger = z.infer<typeof caseFlowCloseTriggerSchema>
export type CaseFlowCloseBlocker = z.infer<typeof caseFlowCloseBlockerSchema>
