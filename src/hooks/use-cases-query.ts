import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  bulkAssignCases,
  assignCase,
  fetchCases,
  fetchQueues,
  updateCasePriority,
} from '#/apis/cases'
import { fetchUsers } from '#/apis/users'
import type { CaseFilters } from '#/schemas/cases.schema'

export const CASES_KEY = ['cases'] as const
export const CASES_PAGE_SIZE = 30

export const QUEUES_KEY = ['queues'] as const
export const USERS_KEY = ['users'] as const

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
    staleTime: 30_000,
  })
}

export function queuesQueryOptions() {
  return queryOptions({
    queryKey: [...QUEUES_KEY],
    queryFn: fetchQueues,
    staleTime: 5 * 60_000, // 5 minutes — queues rarely change
  })
}

export function usersQueryOptions() {
  return queryOptions({
    queryKey: [...USERS_KEY],
    queryFn: fetchUsers,
    staleTime: 5 * 60_000,
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
    onError: () => {
      toast.error('Failed to assign cases.')
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
    onError: () => {
      toast.error('Failed to assign case owner.')
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
    onError: () => {
      toast.error('Failed to update case priority.')
    },
  })
}
