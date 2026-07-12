import { z } from 'zod'
import { QUEUE_LIFECYCLES, QUEUE_WORKFLOW_TYPES } from './queue-workflow.schema'

const limitRangeSchema = z.object({
  collectionMin: z.coerce.number().min(0),
  collectionMax: z.coerce.number().min(0),
  disbursementMin: z.coerce.number().min(0),
  disbursementMax: z.coerce.number().min(0),
})

const emailAddressSchema = z.string().email()

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
  documentsReviewResubmissionHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(8760)
    .nullable(),
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

export const subMerchantOptionSchema = subMerchantDraftSchema.pick({
  id: true,
  name: true,
})

export const subMerchantOptionsSchema = z.array(subMerchantOptionSchema)

export const caseFlowQueueSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  prefix: z.string(),
  workflowType: z.enum(QUEUE_WORKFLOW_TYPES).optional(),
  lifecycle: z.enum(QUEUE_LIFECYCLES).optional(),
  isActive: z.boolean(),
})

export const caseFlowStartRuleSchema = z.object({
  id: z.string().uuid().optional(),
  targetQueueId: z.string(),
  order: z.number(),
  isActive: z.boolean(),
})

export const caseFlowCloseTriggerSchema = z.object({
  id: z.string().uuid().optional(),
  sourceQueueId: z.string(),
  targetQueueId: z.string(),
  order: z.number(),
  isActive: z.boolean(),
})

export const caseFlowCloseBlockerSchema = z.object({
  id: z.string().uuid().optional(),
  blockedQueueId: z.string(),
  prerequisiteQueueId: z.string(),
  isActive: z.boolean(),
})

export const caseFlowCreationRequirementSchema = z.object({
  id: z.string().uuid().optional(),
  targetQueueId: z.string(),
  prerequisiteQueueId: z.string(),
  isActive: z.boolean(),
})

export const caseFlowConfigurationSchema = z.object({
  revision: z.number().int().min(1),
  queues: z.array(caseFlowQueueSchema),
  startRules: z.array(caseFlowStartRuleSchema),
  closeTriggers: z.array(caseFlowCloseTriggerSchema),
  closeBlockers: z.array(caseFlowCloseBlockerSchema),
  creationRequirements: z.array(caseFlowCreationRequirementSchema).default([]),
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

export const merchantPortalSettingsSchema = z.object({
  loginUrl: z.string().trim().url(),
  officeAddress: z.string().trim().max(1000).default(''),
  whatsappSupportNumber: z
    .string()
    .trim()
    .max(32)
    .regex(/^\d*$/, 'WhatsApp support number must contain numbers only.')
    .default(''),
  supportEmail: z
    .string()
    .trim()
    .max(320)
    .refine((value) => value === '' || emailAddressSchema.safeParse(value).success, {
      message: 'Enter a valid support email.',
    })
    .default(''),
})

export const paymentMethodSettingsSchema = z
  .array(
    z.object({
      id: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(80),
    }),
  )
  .max(50)
  .superRefine((methods, ctx) => {
    const seen = new Set<string>()
    for (const method of methods) {
      const key = method.label.trim().toLowerCase()
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Method names must be unique.',
          path: ['paymentMethods'],
        })
        return
      }
      seen.add(key)
    }
  })

export const configurationOverviewSchema = z.object({
  limitsAndMdr: limitsAndMdrSettingsSchema,
  linkDeadlines: linkDeadlineSettingsSchema,
  emailSendingMode: emailSendingModeSchema,
  merchantPortal: merchantPortalSettingsSchema,
  paymentMethods: paymentMethodSettingsSchema,
  payoutMethods: paymentMethodSettingsSchema,
  agreementDrafts: z.array(agreementDraftSchema),
  subMerchants: z.array(subMerchantDraftSchema),
  businessTypes: z.array(businessTypeOptionSchema),
})

export type LimitsAndMdrSettings = z.infer<typeof limitsAndMdrSettingsSchema>
export type LinkDeadlineSettings = z.infer<typeof linkDeadlineSettingsSchema>
export type EmailSendingMode = z.infer<typeof emailSendingModeSchema>
export type MerchantPortalSettings = z.infer<
  typeof merchantPortalSettingsSchema
>
export type PaymentMethodSettings = z.infer<typeof paymentMethodSettingsSchema>
export type PaymentMethod = PaymentMethodSettings[number]
export type ConfigurationOverview = z.infer<typeof configurationOverviewSchema>
export type SubMerchantOption = z.infer<typeof subMerchantOptionSchema>
export type CaseFlowConfiguration = z.infer<typeof caseFlowConfigurationSchema>
export type CaseFlowStartRule = z.infer<typeof caseFlowStartRuleSchema>
export type CaseFlowCloseTrigger = z.infer<typeof caseFlowCloseTriggerSchema>
export type CaseFlowCloseBlocker = z.infer<typeof caseFlowCloseBlockerSchema>
export type CaseFlowCreationRequirement = z.infer<
  typeof caseFlowCreationRequirementSchema
>
