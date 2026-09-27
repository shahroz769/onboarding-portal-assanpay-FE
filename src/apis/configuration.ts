import { apiClient } from '#/lib/api-client'
import type {
  CaseFlowConfiguration,
  CaseFlowBackfillPreview,
  CaseFlowBackfillResult,
  AgreementDraft,
  EmailRecipientSettings,
  EmailSendingMode,
  EmailTemplatePreview,
  LimitsAndMdrSettings,
  MerchantPortalSettings,
  PaymentMethodSettings,
  PayoutMethodSettings,
  SubMerchantOption,
  SubMerchantDraft,
} from '#/schemas/configuration.schema'
import {
  caseFlowConfigurationSchema,
  caseFlowBackfillPreviewSchema,
  caseFlowBackfillResultSchema,
  agreementDraftSchema,
  emailRecipientSettingsSchema,
  emailSendingModeSchema,
  emailTemplatePreviewSchema,
  limitsAndMdrSettingsSchema,
  merchantPortalSettingsSchema,
  paymentMethodSettingsSchema,
  payoutMethodSettingsSchema,
  subMerchantDraftSchema,
  subMerchantOptionsSchema,
} from '#/schemas/configuration.schema'

export async function fetchSubMerchantOptions(): Promise<SubMerchantOption[]> {
  const response = await apiClient.get('/api/configuration/sub-merchants')
  return subMerchantOptionsSchema.parse(response.data)
}

export async function fetchLimitsAndMdr(): Promise<LimitsAndMdrSettings> {
  const response = await apiClient.get('/api/configuration/limits-and-mdr')
  return limitsAndMdrSettingsSchema.parse(response.data)
}

export async function fetchPaymentMethods(): Promise<PaymentMethodSettings> {
  const response = await apiClient.get('/api/configuration/payment-methods')
  return paymentMethodSettingsSchema.parse(response.data)
}

export async function fetchPayoutMethods(): Promise<PayoutMethodSettings> {
  const response = await apiClient.get('/api/configuration/payout-methods')
  return payoutMethodSettingsSchema.parse(response.data)
}

export async function fetchAgreementDrafts(): Promise<AgreementDraft[]> {
  const response = await apiClient.get('/api/configuration/agreements')
  return agreementDraftSchema.array().parse(response.data)
}

export async function fetchSubMerchantDrafts(): Promise<SubMerchantDraft[]> {
  const response = await apiClient.get(
    '/api/configuration/sub-merchants/drafts',
  )
  return subMerchantDraftSchema.array().parse(response.data)
}

export async function fetchMerchantPortal(): Promise<MerchantPortalSettings> {
  const response = await apiClient.get('/api/configuration/merchant-portal')
  return merchantPortalSettingsSchema.parse(response.data)
}

export async function fetchEmailSendingMode(): Promise<EmailSendingMode> {
  const response = await apiClient.get('/api/configuration/email-sending-mode')
  return emailSendingModeSchema.parse(response.data)
}

export async function updateEmailSendingMode(input: EmailSendingMode) {
  const response = await apiClient.put(
    '/api/configuration/email-sending-mode',
    input,
  )
  return response.data
}

export async function fetchEmailRecipients(): Promise<EmailRecipientSettings> {
  const response = await apiClient.get('/api/configuration/email-recipients')
  return emailRecipientSettingsSchema.parse(response.data)
}

export async function updateEmailRecipients(input: EmailRecipientSettings) {
  const response = await apiClient.put(
    '/api/configuration/email-recipients',
    input,
  )
  return emailRecipientSettingsSchema.parse(response.data)
}

export async function updateMerchantPortal(input: MerchantPortalSettings) {
  const response = await apiClient.put(
    '/api/configuration/merchant-portal',
    input,
  )
  return merchantPortalSettingsSchema.parse(response.data)
}

export async function updatePaymentMethods(input: PaymentMethodSettings) {
  const response = await apiClient.put(
    '/api/configuration/payment-methods',
    input,
  )
  return response.data
}

export async function updatePayoutMethods(input: PayoutMethodSettings) {
  const response = await apiClient.put(
    '/api/configuration/payout-methods',
    input,
  )
  return response.data
}

export async function fetchCaseFlowConfiguration(
  versionId?: number,
): Promise<CaseFlowConfiguration> {
  const response = await apiClient.get(
    versionId
      ? `/api/configuration/case-flow/versions/${versionId}`
      : '/api/configuration/case-flow',
  )
  return caseFlowConfigurationSchema.parse(response.data)
}

export async function updateCaseFlowConfiguration(
  input: CaseFlowConfiguration,
): Promise<CaseFlowConfiguration> {
  const payload = {
    revision: input.revision,
    changeNote: input.changeNote,
    startRules: input.startRules.map((rule) => ({
      ...(rule.id ? { id: rule.id } : {}),
      targetQueueId: rule.targetQueueId,
      order: rule.order,
      isActive: rule.isActive,
    })),
    closeTriggers: input.closeTriggers.map((rule) => ({
      ...(rule.id ? { id: rule.id } : {}),
      sourceQueueId: rule.sourceQueueId,
      targetQueueId: rule.targetQueueId,
      order: rule.order,
      isActive: rule.isActive,
    })),
    closeBlockers: input.closeBlockers.map((rule) => ({
      ...(rule.id ? { id: rule.id } : {}),
      blockedQueueId: rule.blockedQueueId,
      prerequisiteQueueId: rule.prerequisiteQueueId,
      isActive: rule.isActive,
    })),
    creationRequirements: input.creationRequirements.map((rule) => ({
      ...(rule.id ? { id: rule.id } : {}),
      targetQueueId: rule.targetQueueId,
      prerequisiteQueueId: rule.prerequisiteQueueId,
      isActive: rule.isActive,
    })),
  }

  const response = await apiClient.put('/api/configuration/case-flow', payload)
  return caseFlowConfigurationSchema.parse(response.data)
}

export async function previewMissingCloseTriggerCases(
  triggerId: string,
): Promise<CaseFlowBackfillPreview> {
  const response = await apiClient.get(
    '/api/cases/flow-jobs/backfill/preview',
    { params: { triggerId } },
  )
  return caseFlowBackfillPreviewSchema.parse(response.data)
}

export async function createMissingCloseTriggerCases(
  triggerId: string,
): Promise<CaseFlowBackfillResult> {
  const response = await apiClient.post('/api/cases/flow-jobs/backfill', {
    triggerId,
  })
  return caseFlowBackfillResultSchema.parse(response.data)
}

export async function uploadAgreementDraft({
  businessType,
  file,
}: {
  businessType: string
  file: File
}) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post(
    `/api/configuration/agreements/${businessType}/draft`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return response.data
}

export async function createSubMerchantDraft({
  name,
  sellerCode,
  file,
}: {
  name: string
  sellerCode: string
  file: File
}) {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('sellerCode', sellerCode)
  formData.append('file', file)
  const response = await apiClient.post(
    '/api/configuration/sub-merchants',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return response.data
}

export async function updateSubMerchantDraft({
  id,
  name,
  sellerCode,
  file,
}: {
  id: string
  name: string
  sellerCode: string
  file: File | null
}) {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('sellerCode', sellerCode)
  if (file) formData.append('file', file)
  const response = await apiClient.patch(
    `/api/configuration/sub-merchants/${id}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return response.data
}

export async function updateQueueSla({
  queueId,
  slaHours,
  revision,
}: {
  queueId: string
  slaHours: number
  revision?: number
}) {
  const response = await apiClient.patch(`/api/queues/${queueId}/sla`, {
    slaHours,
    ...(revision != null ? { revision } : {}),
  })
  return response.data
}

export async function fetchEmailTemplatePreview(
  key: string,
): Promise<EmailTemplatePreview> {
  const response = await apiClient.get(
    `/api/configuration/email-templates/${encodeURIComponent(key)}`,
  )
  return emailTemplatePreviewSchema.parse(response.data)
}
