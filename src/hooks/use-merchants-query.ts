import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  bulkDeleteMerchants,
  bulkUpdatePriority,
  deleteMerchant,
  fetchMerchants,
  updateMerchantPriority,
} from '#/apis/merchants'
import type {
  MerchantFilters,
  MerchantListResponse,
  Priority,
} from '#/schemas/merchants.schema'

const MERCHANTS_KEY = ['merchants'] as const

function merchantsQueryKey(filters: MerchantFilters) {
  return [...MERCHANTS_KEY, filters] as const
}

export { MERCHANTS_KEY }

export function useMerchantsInfiniteQuery(filters: MerchantFilters) {
  return useInfiniteQuery({
    queryKey: merchantsQueryKey(filters),
    queryFn: ({ pageParam }) =>
      fetchMerchants({
        ...filters,
        cursor: pageParam ?? undefined,
        limit: 30,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

export function useUpdatePriorityMutation(filters: MerchantFilters) {
  const queryClient = useQueryClient()
  const key = merchantsQueryKey(filters)

  return useMutation({
    mutationFn: ({
      merchantId,
      priority,
      note,
    }: {
      merchantId: string
      priority: Priority
      note?: string
    }) => updateMerchantPriority({ merchantId, priority, note }),
    onMutate: async ({ merchantId, priority, note }) => {
      await queryClient.cancelQueries({ queryKey: key })

      const previous = queryClient.getQueryData(key)

      queryClient.setQueryData<{
        pages: MerchantListResponse[]
        pageParams: (string | null)[]
      }>(key, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            merchants: page.merchants.map((m) =>
              m.id === merchantId
                ? { ...m, priority, priorityNote: note ?? m.priorityNote }
                : m,
            ),
          })),
        }
      })

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous)
      }
      toast.error('Failed to update priority.')
    },
    onSuccess: () => {
      toast.success('Priority updated.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function useDeleteMerchantMutation(filters: MerchantFilters) {
  const queryClient = useQueryClient()
  const key = merchantsQueryKey(filters)

  return useMutation({
    mutationFn: (merchantId: string) => deleteMerchant(merchantId),
    onMutate: async (merchantId) => {
      await queryClient.cancelQueries({ queryKey: key })

      const previous = queryClient.getQueryData(key)

      queryClient.setQueryData<{
        pages: MerchantListResponse[]
        pageParams: (string | null)[]
      }>(key, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            merchants: page.merchants.filter((m) => m.id !== merchantId),
            totalCount: page.totalCount - 1,
          })),
        }
      })

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous)
      }
      toast.error('Failed to delete merchant.')
    },
    onSuccess: () => {
      toast.success('Merchant deleted.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function useBulkDeleteMutation(filters: MerchantFilters) {
  const queryClient = useQueryClient()
  const key = merchantsQueryKey(filters)

  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteMerchants(ids),
    onSuccess: () => {
      toast.success('Merchants deleted.')
      queryClient.invalidateQueries({ queryKey: key })
    },
    onError: () => {
      toast.error('Failed to delete merchants.')
    },
  })
}

export function useBulkPriorityMutation(filters: MerchantFilters) {
  const queryClient = useQueryClient()
  const key = merchantsQueryKey(filters)

  return useMutation({
    mutationFn: ({ ids, priority }: { ids: string[]; priority: Priority }) =>
      bulkUpdatePriority(ids, priority),
    onSuccess: () => {
      toast.success('Priority updated for selected merchants.')
      queryClient.invalidateQueries({ queryKey: key })
    },
    onError: () => {
      toast.error('Failed to update priority.')
    },
  })
}
