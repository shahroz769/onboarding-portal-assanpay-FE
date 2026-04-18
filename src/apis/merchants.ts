import { apiClient } from '#/lib/api-client'
import type {
  MerchantFilters,
  MerchantListResponse,
  Priority,
} from '#/schemas/merchants.schema'

// ─── List Merchants ─────────────────────────────────────────────────────────

interface FetchMerchantsParams extends MerchantFilters {
  page?: number
  perPage?: number
}

export async function fetchMerchants(
  params: FetchMerchantsParams,
): Promise<MerchantListResponse> {
  // Strip undefined values so they don't appear as "undefined" in query string
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query[key] = String(value)
    }
  }

  const response = await apiClient.get<MerchantListResponse>(
    '/api/merchants',
    { params: query },
  )
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

// ─── Delete Merchant ────────────────────────────────────────────────────────

export async function deleteMerchant(merchantId: string) {
  const response = await apiClient.delete(`/api/merchants/${merchantId}`)
  return response.data
}

// ─── Bulk Delete ────────────────────────────────────────────────────────────

export async function bulkDeleteMerchants(ids: string[]) {
  const response = await apiClient.post('/api/merchants/bulk-delete', { ids })
  return response.data
}

// ─── Bulk Priority Update ───────────────────────────────────────────────────

export async function bulkUpdatePriority(ids: string[], priority: Priority) {
  const response = await apiClient.post('/api/merchants/bulk-priority', {
    ids,
    priority,
  })
  return response.data
}
