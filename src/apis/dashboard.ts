import { apiClient } from '#/lib/api-client'
import type {
  AppliedPortalMids,
  ApplyPortalMidLimitsInput,
  ApplyPortalMidLimitsResponse,
  AwaitingPhysicalAgreementsPage,
  CaseWorkloadResponse,
  DashboardResponse,
  DashboardRouteSearch,
  PendingPortalMidGroup,
  PendingPortalMidsPage,
} from '#/schemas/dashboard.schema'
import {
  appliedPortalMidsSchema,
  applyPortalMidLimitsResponseSchema,
  awaitingPhysicalAgreementsPageSchema,
  caseWorkloadResponseSchema,
  dashboardResponseSchema,
  pendingPortalMidValuesSchema,
  pendingPortalMidsPageSchema,
} from '#/schemas/dashboard.schema'

export async function fetchDashboard(
  params: DashboardRouteSearch,
): Promise<DashboardResponse> {
  const query: Record<string, string> = { range: params.range }

  if (params.range === 'custom') {
    if (params.from) query.from = params.from
    if (params.to) query.to = params.to
  }

  const response = await apiClient.get('/api/dashboard', { params: query })
  return dashboardResponseSchema.parse(response.data)
}

export async function fetchCaseWorkload(): Promise<CaseWorkloadResponse> {
  const response = await apiClient.get('/api/dashboard/workload')
  return caseWorkloadResponseSchema.parse(response.data)
}

export async function applyPortalMidLimits(
  input: ApplyPortalMidLimitsInput,
): Promise<ApplyPortalMidLimitsResponse> {
  const response = await apiClient.post(
    '/api/dashboard/portal-mids/apply-limits',
    input,
  )
  return applyPortalMidLimitsResponseSchema.parse(response.data)
}

export async function fetchPendingPortalMids(params: {
  cursor: string | null
  limit: number
}): Promise<PendingPortalMidsPage> {
  const response = await apiClient.get('/api/dashboard/portal-mids/pending', {
    params: {
      limit: params.limit,
      ...(params.cursor ? { cursor: params.cursor } : {}),
    },
  })
  return pendingPortalMidsPageSchema.parse(response.data)
}

export async function fetchAppliedPortalMids(): Promise<AppliedPortalMids> {
  const response = await apiClient.get('/api/dashboard/portal-mids/applied')
  return appliedPortalMidsSchema.parse(response.data)
}

/** Every pending MID in the DB (not just loaded rows); all kinds when omitted. */
export async function fetchPendingPortalMidValues(
  group?: PendingPortalMidGroup,
): Promise<number[]> {
  const response = await apiClient.get(
    '/api/dashboard/portal-mids/pending/mids',
    { params: group ? { group } : {} },
  )
  return pendingPortalMidValuesSchema.parse(response.data).mids
}

export async function fetchAwaitingPhysicalAgreements(params: {
  cursor: string | null
  limit: number
}): Promise<AwaitingPhysicalAgreementsPage> {
  const response = await apiClient.get(
    '/api/dashboard/agreements/awaiting-physical',
    {
      params: {
        limit: params.limit,
        ...(params.cursor ? { cursor: params.cursor } : {}),
      },
    },
  )
  return awaitingPhysicalAgreementsPageSchema.parse(response.data)
}
