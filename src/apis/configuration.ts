import { apiClient } from '#/lib/api-client'
import type {
  ConfigurationOverview,
  LimitsAndMdrSettings,
  LinkDeadlineSettings,
} from '#/schemas/configuration.schema'
import { configurationOverviewSchema } from '#/schemas/configuration.schema'

export async function fetchConfiguration(): Promise<ConfigurationOverview> {
  const response = await apiClient.get('/api/configuration')
  return configurationOverviewSchema.parse(response.data)
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
  file,
}: {
  name: string
  file: File
}) {
  const formData = new FormData()
  formData.append('name', name)
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
