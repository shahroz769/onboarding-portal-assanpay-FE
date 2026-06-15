import { apiClient } from '#/lib/api-client'
import type {
  CaseFlowConfiguration,
  ConfigurationOverview,
  EmailSendingMode,
  LimitsAndMdrSettings,
  LinkDeadlineSettings,
  MerchantPortalSettings,
  PaymentMethodSettings,
  SubMerchantOption,
} from '#/schemas/configuration.schema'
import {
  caseFlowConfigurationSchema,
  configurationOverviewSchema,
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
  return response.data
}

export async function updatePaymentMethods(input: PaymentMethodSettings) {
  const response = await apiClient.put(
    '/api/configuration/payment-methods',
    input,
  )
  return response.data
}

export async function updatePayoutMethods(input: PaymentMethodSettings) {
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
    startRules: input.startRules.map((rule) => ({
      targetQueueId: rule.targetQueueId,
      order: rule.order,
      isActive: rule.isActive,
    })),
    closeTriggers: input.closeTriggers.map((rule) => ({
      sourceQueueId: rule.sourceQueueId,
      targetQueueId: rule.targetQueueId,
      order: rule.order,
      isActive: rule.isActive,
    })),
    closeBlockers: input.closeBlockers.map((rule) => ({
      blockedQueueId: rule.blockedQueueId,
      prerequisiteQueueId: rule.prerequisiteQueueId,
      isActive: rule.isActive,
    })),
    ...(input.creationRequirements.length > 0
      ? {
          creationRequirements: input.creationRequirements.map((rule) => ({
            targetQueueId: rule.targetQueueId,
            prerequisiteQueueId: rule.prerequisiteQueueId,
            isActive: rule.isActive,
          })),
        }
      : {}),
  }

  const response = await apiClient.put('/api/configuration/case-flow', payload)
  return caseFlowConfigurationSchema.parse(response.data)
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
    { headers: { 'Content-Type': 'multipart/form-data' } },
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
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  )
  return response.data
}

export async function updateQueueStatus({
  queueId,
  isActive,
}: {
  queueId: string
  isActive: boolean
}) {
  const response = await apiClient.patch(`/api/queues/${queueId}/status`, {
    isActive,
  })
  return response.data
}

export async function updateQueueSla({
  queueId,
  slaHours,
}: {
  queueId: string
  slaHours: number
}) {
  const response = await apiClient.patch(`/api/queues/${queueId}/sla`, {
    slaHours,
  })
  return response.data
}
