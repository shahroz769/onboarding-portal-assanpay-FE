import { apiClient } from '#/lib/api-client'
import type {
  ApplyPortalMidLimitsInput,
  ApplyPortalMidLimitsResponse,
  DashboardResponse,
  DashboardRouteSearch,
} from '#/schemas/dashboard.schema'
import {
  applyPortalMidLimitsResponseSchema,
  dashboardResponseSchema,
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

export async function applyPortalMidLimits(
  input: ApplyPortalMidLimitsInput,
): Promise<ApplyPortalMidLimitsResponse> {
  const response = await apiClient.post(
    '/api/dashboard/portal-mids/apply-limits',
    input,
  )
  return applyPortalMidLimitsResponseSchema.parse(response.data)
}
