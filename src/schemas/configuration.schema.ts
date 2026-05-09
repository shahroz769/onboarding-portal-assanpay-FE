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
  passwordResetHours: z.coerce.number().int().min(1).max(720),
  newPasswordSetHours: z.coerce.number().int().min(1).max(720),
  agreementLinkHours: z.coerce.number().int().min(1).max(720),
  documentsReviewResubmissionHours: z.coerce.number().int().min(1).max(720),
  goLiveAvailabilityHours: z.coerce.number().int().min(1).max(720),
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
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  googleDriveWebViewLink: z.string(),
  googleDriveDownloadLink: z.string().nullable(),
  googleDriveFolderId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const configurationOverviewSchema = z.object({
  limitsAndMdr: limitsAndMdrSettingsSchema,
  linkDeadlines: linkDeadlineSettingsSchema,
  agreementDrafts: z.array(agreementDraftSchema),
  subMerchants: z.array(subMerchantDraftSchema),
  businessTypes: z.array(businessTypeOptionSchema),
})

export type LimitsAndMdrSettings = z.infer<typeof limitsAndMdrSettingsSchema>
export type LinkDeadlineSettings = z.infer<typeof linkDeadlineSettingsSchema>
export type ConfigurationOverview = z.infer<typeof configurationOverviewSchema>
