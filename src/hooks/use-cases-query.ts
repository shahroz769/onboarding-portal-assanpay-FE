import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  bulkAssignCases,
  bulkCreateCases,
  assignCase,
  createCase,
  fetchCases,
  fetchQueues,
  updateCasePriority,
} from '#/apis/cases'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import type { CaseFilters, CaseRouteSearch } from '#/schemas/cases.schema'

export const CASES_KEY = ['cases'] as const
export const CASES_PAGE_SIZE = 30

export const QUEUES_KEY = ['queues'] as const

/** Build a stable infinite-query key from filters. */
export function casesInfiniteKey(filters: CaseFilters) {
  return [...CASES_KEY, filters] as const
}

export function casesInfiniteQueryOptions(filters: CaseFilters) {
  return infiniteQueryOptions({
    queryKey: casesInfiniteKey(filters),
    queryFn: ({ pageParam }) =>
      fetchCases({
        ...filters,
        cursor: pageParam,
        limit: CASES_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/**
 * The list query a cases table runs for these filters. Shared by the table
 * and the cases route loaders, so a prefetch lands on the exact same key.
 */
export function casesTableQueryOptions(
  filters: CaseRouteSearch,
  queueAccess: 'view' | 'work',
) {
  return casesInfiniteQueryOptions({
    ...filters,
    queueAccess,
    createdAtFrom: undefined,
    createdAtTo: undefined,
  })
}

/**
 * Starts the requests a cases table makes on mount (its rows and the queue
 * picker), from a route loader. Nothing is awaited: the table keeps its own
 * loading and error states. Filter options load when a filter is opened.
 */
export function prefetchCasesTable(
  queryClient: QueryClient,
  filters: CaseRouteSearch,
  queueAccess: 'view' | 'work',
) {
  void queryClient.prefetchInfiniteQuery(
    casesTableQueryOptions(filters, queueAccess),
  )
  void queryClient.prefetchQuery(queuesQueryOptions())
}

export function queuesQueryOptions(
  options: { includeInactive?: boolean } = {},
) {
  return queryOptions({
    queryKey: [...QUEUES_KEY, options],
    queryFn: () => fetchQueues(options),
    staleTime: 5 * 60_000, // 5 minutes — queues rarely change
  })
}

export function useCreateCaseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      merchantId,
      queueId,
    }: {
      merchantId: string
      queueId: string
    }) => createCase({ merchantId, queueId }),
    onSuccess: async (createdCase) => {
      toast.success(`Case ${createdCase.caseNumber} created.`)
      await queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to create case.'))
    },
  })
}

export function useBulkCreateCasesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkCreateCases,
    onSuccess: async ({ created, failed }) => {
      if (created.length > 0) {
        toast.success(
          `Created ${created.length} case${created.length === 1 ? '' : 's'}.`,
        )
      }
      if (failed.length > 0) {
        toast.error(
          `${failed.length} merchant${failed.length === 1 ? '' : 's'} skipped: ${failed[0]?.error}`,
        )
      }
      await queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to create cases.'))
    },
  })
}

export function useBulkAssignCasesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ ids, ownerId }: { ids: string[]; ownerId: string | null }) =>
      bulkAssignCases(ids, ownerId),
    onSuccess: async () => {
      toast.success('Cases assigned successfully.')
      await queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to assign cases.'))
    },
  })
}

export function useAssignCaseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      caseId,
      ownerId,
    }: {
      caseId: string
      ownerId: string | null
    }) => assignCase({ caseId, ownerId }),
    onSuccess: async () => {
      toast.success('Case owner updated.')
      await queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to assign case owner.'))
    },
  })
}

export function useUpdateCasePriorityMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      caseId,
      priority,
    }: {
      caseId: string
      priority: 'normal' | 'high'
    }) => updateCasePriority({ caseId, priority }),
    onSuccess: async () => {
      toast.success('Case priority updated.')
      await queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update case priority.'))
    },
  })
}
