import { apiClient } from '#/lib/api-client'
import type {
  MerchantFilters,
  MerchantListResponse,
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
