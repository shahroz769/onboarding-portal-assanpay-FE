import { apiClient } from '#/lib/api-client'
import type {
  CaseFlowConfiguration,
  CaseFlowBackfillPreview,
  CaseFlowBackfillResult,
  ConfigurationOverview,
  AgreementDraft,
  EmailSendingMode,
  LimitsAndMdrSettings,
  LinkDeadlineSettings,
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
  configurationOverviewSchema,
  agreementDraftSchema,
  emailSendingModeSchema,
  limitsAndMdrSettingsSchema,
  linkDeadlineSettingsSchema,
  merchantPortalSettingsSchema,
  paymentMethodSettingsSchema,
  payoutMethodSettingsSchema,
  subMerchantDraftSchema,
  subMerchantOptionsSchema,
} from '#/schemas/configuration.schema'

export async function fetchConfiguration(): Promise<ConfigurationOverview> {
  const response = await apiClient.get('/api/configuration')
  return configurationOverviewSchema.parse(response.data)
}

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

export async function fetchLinkDeadlines(): Promise<LinkDeadlineSettings> {
  const response = await apiClient.get('/api/configuration/link-deadlines')
  return linkDeadlineSettingsSchema.parse(response.data)
}

export async function fetchEmailSendingMode(): Promise<EmailSendingMode> {
  const response = await apiClient.get('/api/configuration/email-sending-mode')
  return emailSendingModeSchema.parse(response.data)
}

export async function updateLimitsAndMdr(input: LimitsAndMdrSettings) {
  const response = await apiClient.put(
    '/api/configuration/limits-and-mdr',
    input,
  )
  return response.data
}

export async function updateLinkDeadlines(input: LinkDeadlineSettings) {
  const response = await apiClient.put(
    '/api/configuration/link-deadlines',
    input,
  )
  return response.data
}

export async function updateEmailSendingMode(input: EmailSendingMode) {
  const response = await apiClient.put(
    '/api/configuration/email-sending-mode',
    input,
  )
  return response.data
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

export async function fetchCaseFlowConfiguration(): Promise<CaseFlowConfiguration> {
  const response = await apiClient.get('/api/configuration/case-flow')
  return caseFlowConfigurationSchema.parse(response.data)
}

export async function updateCaseFlowConfiguration(
  input: CaseFlowConfiguration,
): Promise<CaseFlowConfiguration> {
  const payload = {
    revision: input.revision,
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

export async function enqueueMissingCloseTriggerCases(
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

export async function updateQueueStatus({
  queueId,
  isActive,
  lifecycle,
  revision,
}: {
  queueId: string
  isActive?: boolean
  lifecycle?: 'draft' | 'active' | 'inactive'
  revision?: number
}) {
  const response = await apiClient.patch(`/api/queues/${queueId}/status`, {
    ...(lifecycle ? { lifecycle } : { isActive }),
    ...(revision != null ? { revision } : {}),
  })
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

export async function createQueue(input: {
  name: string
  slug: string
  prefix: string
  workflowType:
    | 'generic'
    | 'document_review'
    | 'agreement'
    | 'mid'
    | 'testing'
    | 'wordpress'
    | 'card'
    | 'live'
    | 'sub_merchant_form'
  lifecycle?: 'draft' | 'inactive'
  qcEnabled?: boolean
  slaHours?: number
  stageTemplate?: string
}) {
  const response = await apiClient.post('/api/queues', input)
  return response.data
}

export async function fetchQueueDetail(queueId: string) {
  const response = await apiClient.get(`/api/queues/${queueId}`)
  return response.data as {
    id: string
    name: string
    slug: string
    prefix: string
    workflowType: string
    lifecycle: 'draft' | 'active' | 'inactive'
    revision: number
    qcEnabled: boolean
    slaHours: number
    isActive: boolean
    stages: Array<{
      id: string
      name: string
      slug: string
      order: number
      category: string
      isActive: boolean
      capabilities: Record<string, unknown> | null
    }>
    activation: {
      ready: boolean
      issues: Array<{ code: string; message: string }>
    }
  }
}

export async function updateQueue(input: {
  queueId: string
  revision: number
  name?: string
  prefix?: string
  lifecycle?: 'draft' | 'active' | 'inactive'
  slaHours?: number
  qcEnabled?: boolean
  stages?: Array<{
    name: string
    slug: string
    order: number
    category: 'new' | 'in_progress' | 'qc' | 'error' | 'closed'
    isActive?: boolean
  }>
}) {
  const { queueId, ...body } = input
  const response = await apiClient.patch(`/api/queues/${queueId}`, body)
  return response.data
}
