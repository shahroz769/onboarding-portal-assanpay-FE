import {
  infiniteQueryOptions,
  keepPreviousData,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { fetchEpMerchants, triggerEpCase } from '#/apis/ep-sub-merchants'
import { CASES_KEY } from '#/hooks/use-cases-query'
import { MERCHANTS_KEY } from '#/hooks/use-merchants-query'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import {
  DEFAULT_EP_PROGRESS_FILTER,
  DEFAULT_EP_WORDPRESS_FILTER,
  EP_FILTER_ALL,
} from '#/schemas/ep-sub-merchants.schema'
import type {
  EpMerchantFilters,
  EpMerchantRouteSearch,
} from '#/schemas/ep-sub-merchants.schema'

export const EP_MERCHANTS_KEY = ['ep-sub-merchants'] as const
const EP_MERCHANTS_PAGE_SIZE = 30

export function epMerchantsInfiniteQueryOptions(filters: EpMerchantFilters) {
  return infiniteQueryOptions({
    queryKey: [...EP_MERCHANTS_KEY, filters] as const,
    queryFn: ({ pageParam }) =>
      fetchEpMerchants({
        ...filters,
        cursor: pageParam,
        limit: EP_MERCHANTS_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    // Case work happens on other pages, so returning here always refetches.
    staleTime: 0,
  })
}

// A filter left out of the URL falls back to its default; "all" turns it off.
function appliedEpFilter(value: string | undefined, defaultValue: string) {
  const applied = value ?? defaultValue
  return applied === EP_FILTER_ALL ? undefined : applied
}

/** The API filters the EP sub-merchants table sends for these search params. */
export function epMerchantsTableFilters(
  search: EpMerchantRouteSearch,
): EpMerchantFilters {
  return {
    search: search.search,
    status: search.status === EP_FILTER_ALL ? undefined : search.status,
    wordpress: appliedEpFilter(search.wordpress, DEFAULT_EP_WORDPRESS_FILTER),
    progress: appliedEpFilter(search.progress, DEFAULT_EP_PROGRESS_FILTER),
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
  }
}

export function useTriggerEpCaseMutation() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: triggerEpCase,
    onSuccess: (createdCase) => {
      toast.success(`Case ${createdCase.caseNumber} created.`, {
        action: {
          label: 'Open Case',
          onClick: () =>
            void navigate({
              to: '/cases/$caseId',
              params: { caseId: createdCase.id },
            }),
        },
      })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to trigger the EP case.'))
    },
    // Also after a failure: it usually means someone else got there first.
    // Not awaited, so the dialog closes without waiting for the lists to reload.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: EP_MERCHANTS_KEY })
      void queryClient.invalidateQueries({ queryKey: CASES_KEY })
      void queryClient.invalidateQueries({ queryKey: MERCHANTS_KEY })
    },
  })
}
