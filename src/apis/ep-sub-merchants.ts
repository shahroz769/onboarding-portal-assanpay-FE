import { apiClient } from '#/lib/api-client'
import type {
  EpMerchantFilters,
  EpMerchantListResponse,
} from '#/schemas/ep-sub-merchants.schema'

interface FetchEpMerchantsParams extends EpMerchantFilters {
  cursor?: string | null
  limit?: number
}

export async function fetchEpMerchants(
  params: FetchEpMerchantsParams,
): Promise<EpMerchantListResponse> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query[key] = String(value)
    }
  }

  const response = await apiClient.get<EpMerchantListResponse>(
    '/api/cases/ep-sub-merchant/merchants',
    { params: query },
  )
  return response.data
}

export async function triggerEpCase(params: {
  merchantId: string
  subMerchantId: string
}) {
  const response = await apiClient.post<{ id: string; caseNumber: string }>(
    '/api/cases/ep-sub-merchant/trigger',
    params,
  )
  return response.data
}
