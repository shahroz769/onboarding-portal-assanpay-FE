import { apiClient } from '#/lib/api-client'
import type {
  CaseFilters,
  CaseListResponse,
  CaseOwner,
  CaseStatus,
  Queue,
} from '#/schemas/cases.schema'

// ─── List Cases ─────────────────────────────────────────────────────────────

interface FetchCasesParams extends CaseFilters {
  page?: number
  perPage?: number
}

export async function fetchCases(
  params: FetchCasesParams,
): Promise<CaseListResponse> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query[key] = String(value)
    }
  }

  const response = await apiClient.get<CaseListResponse>('/api/cases', {
    params: query,
  })
  return response.data
}

// ─── Create Case ────────────────────────────────────────────────────────────

interface CreateCaseParams {
  merchantId: string
  queueId: string
}

export async function createCase(params: CreateCaseParams) {
  const response = await apiClient.post('/api/cases', params)
  return response.data
}

// ─── Update Case Status ─────────────────────────────────────────────────────

interface UpdateCaseStatusParams {
  caseId: string
  status: CaseStatus
}

export async function updateCaseStatus({
  caseId,
  status,
}: UpdateCaseStatusParams) {
  const response = await apiClient.patch(`/api/cases/${caseId}/status`, {
    status,
  })
  return response.data
}

// ─── Assign Case ────────────────────────────────────────────────────────────

interface AssignCaseParams {
  caseId: string
  ownerId: string | null
}

export async function assignCase({ caseId, ownerId }: AssignCaseParams) {
  const response = await apiClient.patch(`/api/cases/${caseId}/assign`, {
    ownerId,
  })
  return response.data
}

// ─── Fetch Queues ───────────────────────────────────────────────────────────

export async function fetchQueues(): Promise<Queue[]> {
  const response = await apiClient.get<Queue[]>('/api/queues')
  return response.data
}

// ─── Fetch Case Owners ──────────────────────────────────────────────────────

export async function fetchCaseOwners(): Promise<CaseOwner[]> {
  const response = await apiClient.get<CaseOwner[]>('/api/cases/owners')
  return response.data
}

// ─── Bulk Assign Cases ──────────────────────────────────────────────────────

export async function bulkAssignCases(ids: string[], ownerId: string | null) {
  const response = await apiClient.post('/api/cases/bulk-assign', {
    ids,
    ownerId,
  })
  return response.data
}

// ─── Update Case Priority ────────────────────────────────────────────────────

export async function updateCasePriority({
  caseId,
  priority,
}: {
  caseId: string
  priority: 'normal' | 'high'
}) {
  const response = await apiClient.patch(`/api/cases/${caseId}/priority`, {
    priority,
  })
  return response.data
}
