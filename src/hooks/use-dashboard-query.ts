import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  applyPortalMidLimits,
  fetchAwaitingPhysicalAgreements,
  fetchDashboard,
  fetchPendingPortalMids,
} from '#/apis/dashboard'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import type {
  ApplyPortalMidLimitsInput,
  DashboardRouteSearch,
} from '#/schemas/dashboard.schema'
import { CASE_DETAIL_KEY } from './use-case-detail-query'
import { CASES_KEY } from './use-cases-query'

export const DASHBOARD_KEY = ['dashboard'] as const

export function dashboardQueryOptions(search: DashboardRouteSearch) {
  return queryOptions({
    queryKey: [...DASHBOARD_KEY, search],
    queryFn: () => fetchDashboard(search),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

const DASHBOARD_LIST_PAGE_SIZE = 15

// Nested under DASHBOARD_KEY so refresh and apply-limits invalidate it too.
export function pendingPortalMidsInfiniteQueryOptions() {
  return infiniteQueryOptions({
    queryKey: [...DASHBOARD_KEY, 'portal-mids', 'pending'],
    queryFn: ({ pageParam }) =>
      fetchPendingPortalMids({
        cursor: pageParam,
        limit: DASHBOARD_LIST_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

export function awaitingPhysicalAgreementsInfiniteQueryOptions() {
  return infiniteQueryOptions({
    queryKey: [...DASHBOARD_KEY, 'agreements', 'awaiting-physical'],
    queryFn: ({ pageParam }) =>
      fetchAwaitingPhysicalAgreements({
        cursor: pageParam,
        limit: DASHBOARD_LIST_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

export function useApplyPortalMidLimits() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ApplyPortalMidLimitsInput) =>
      applyPortalMidLimits(input),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY }),
        queryClient.invalidateQueries({ queryKey: CASES_KEY }),
        queryClient.invalidateQueries({ queryKey: CASE_DETAIL_KEY }),
      ])

      const parts = [
        `${result.applied.length} applied or pre-applied`,
        `${result.alreadyApplied.length} already applied`,
      ]
      if (result.notFound.length > 0) {
        parts.push(`${result.notFound.length} not found`)
      }
      toast.success(`Limits updated: ${parts.join(', ')}`)
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to apply limits'))
    },
  })
}
