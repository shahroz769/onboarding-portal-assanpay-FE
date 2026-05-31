import { queryOptions } from '@tanstack/react-query'

import { fetchDashboard } from '#/apis/dashboard'
import type { DashboardRouteSearch } from '#/schemas/dashboard.schema'

export const DASHBOARD_KEY = ['dashboard'] as const

export function dashboardQueryOptions(search: DashboardRouteSearch) {
  return queryOptions({
    queryKey: [...DASHBOARD_KEY, search],
    queryFn: () => fetchDashboard(search),
    staleTime: 30_000,
  })
}
