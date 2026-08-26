import { apiClient } from '#/lib/api-client'
import type {
  MerchantFilters,
  MerchantFormResponse,
  MerchantHeader,
  MerchantHistoryResponse,
  MerchantLimitsMdr,
  MerchantLimitsResponse,
  MerchantListResponse,
  MerchantOverviewResponse,
  Priority,
} from '#/schemas/merchants.schema'

// ─── List Merchants ─────────────────────────────────────────────────────────

interface FetchMerchantsParams extends MerchantFilters {
  cursor?: string | null
  limit?: number
}

export async function fetchMerchants(
  params: FetchMerchantsParams,
): Promise<MerchantListResponse> {
  // Strip undefined values so they don't appear as "undefined" in query string
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query[key] = String(value)
    }
  }

  const response = await apiClient.get<MerchantListResponse>('/api/merchants', {
    params: query,
  })
  return response.data
}

// ─── Merchant Detail ────────────────────────────────────────────────────────

export async function fetchMerchantHeader(
  merchantId: string,
): Promise<MerchantHeader> {
  const response = await apiClient.get<MerchantHeader>(
    `/api/merchants/${merchantId}`,
  )
  return response.data
}

export async function fetchMerchantOverview(
  merchantId: string,
): Promise<MerchantOverviewResponse> {
  const response = await apiClient.get<MerchantOverviewResponse>(
    `/api/merchants/${merchantId}/overview`,
  )
  return response.data
}

export async function fetchMerchantForm(
  merchantId: string,
): Promise<MerchantFormResponse> {
  const response = await apiClient.get<MerchantFormResponse>(
    `/api/merchants/${merchantId}/form`,
  )
  return response.data
}

export async function fetchMerchantLimits(
  merchantId: string,
): Promise<MerchantLimitsResponse> {
  const response = await apiClient.get<MerchantLimitsResponse>(
    `/api/merchants/${merchantId}/limits-mdr`,
  )
  return response.data
}

export async function fetchMerchantHistory(
  merchantId: string,
): Promise<MerchantHistoryResponse> {
  const response = await apiClient.get<MerchantHistoryResponse>(
    `/api/merchants/${merchantId}/history`,
  )
  return response.data
}

// ─── Per-Merchant Limits & MDR ──────────────────────────────────────────────

export async function updateMerchantLimitsMdr(
  merchantId: string,
  input: MerchantLimitsMdr,
) {
  const response = await apiClient.patch<{
    id: string
    limitsAndMdr: MerchantLimitsMdr
  }>(`/api/merchants/${merchantId}/limits-mdr`, input)
  return response.data
}

export async function resetMerchantLimitsMdr(merchantId: string) {
  const response = await apiClient.delete<{
    id: string
    limitsAndMdr: MerchantLimitsMdr
  }>(`/api/merchants/${merchantId}/limits-mdr`)
  return response.data
}

// ─── Update Priority ────────────────────────────────────────────────────────

interface UpdatePriorityParams {
  merchantId: string
  priority: Priority
  note?: string
}

export async function updateMerchantPriority({
  merchantId,
  priority,
  note,
}: UpdatePriorityParams) {
  const response = await apiClient.patch(
    `/api/merchants/${merchantId}/priority`,
    { priority, note },
  )
  return response.data
}

// ─── Terminate Merchant ─────────────────────────────────────────────────────

export async function terminateMerchant(merchantId: string, reason: string) {
  const response = await apiClient.patch(
    `/api/merchants/${merchantId}/terminate`,
    {
      reason,
    },
  )
  return response.data
}

export async function permanentlyDeleteMerchant(
  merchantId: string,
  confirmation: string,
) {
  const response = await apiClient.delete<{
    id: string
    deletedStorageObjectCount: number
  }>(`/api/merchants/${merchantId}/permanent`, {
    data: { confirmation },
  })
  return response.data
}

// ─── Bulk Terminate ─────────────────────────────────────────────────────────

export async function bulkTerminateMerchants(ids: string[], reason: string) {
  const response = await apiClient.post('/api/merchants/bulk-terminate', {
    ids,
    reason,
  })
  return response.data
}

// ─── Bulk Priority Update ───────────────────────────────────────────────────

export async function bulkUpdatePriority(
  ids: string[],
  priority: Priority,
  note?: string,
) {
  const response = await apiClient.post('/api/merchants/bulk-priority', {
    ids,
    priority,
    note,
  })
  return response.data
}
