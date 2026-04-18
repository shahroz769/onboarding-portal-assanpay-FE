import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  bulkDeleteMerchants,
  bulkUpdatePriority,
  deleteMerchant,
  updateMerchantPriority,
} from '#/apis/merchants'
import type {
  MerchantFilters,
  MerchantListItem,
  MerchantListResponse,
  Priority,
} from '#/schemas/merchants.schema'

export const MERCHANTS_KEY = ['merchants'] as const

/** Build a stable infinite-query key from filters (excludes page/perPage). */
export function merchantsInfiniteKey(filters: MerchantFilters) {
  const { page: _p, perPage: _pp, ...rest } = filters
  return [...MERCHANTS_KEY, rest] as const
}

function updateMerchantInMerchantLists(
  queryClient: ReturnType<typeof useQueryClient>,
  merchantId: string,
  updater: (merchant: MerchantListItem) => MerchantListItem,
) {
  queryClient.setQueriesData<InfiniteData<MerchantListResponse>>(
    { queryKey: MERCHANTS_KEY },
    (old) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          merchants: page.merchants.map((merchant) =>
            merchant.id === merchantId ? updater(merchant) : merchant,
          ),
        })),
      }
    },
  )
}

export function useUpdatePriorityMutation(filters: MerchantFilters) {
  const queryClient = useQueryClient()

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
      await queryClient.cancelQueries({ queryKey: MERCHANTS_KEY })

      const previous =
        queryClient.getQueriesData<InfiniteData<MerchantListResponse>>({
          queryKey: MERCHANTS_KEY,
        })

      updateMerchantInMerchantLists(
        queryClient,
        merchantId,
        (merchant) => ({
          ...merchant,
          priority,
          priorityNote: note ?? null,
        }),
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [queryKey, data] of context.previous) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      toast.error('Failed to update priority.')
    },
    onSuccess: (updatedMerchant) => {
      updateMerchantInMerchantLists(
        queryClient,
        updatedMerchant.id,
        (merchant) => ({
          ...merchant,
          priority: updatedMerchant.priority,
          priorityNote: updatedMerchant.priorityNote,
        }),
      )
      toast.success('Priority updated.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: MERCHANTS_KEY,
        refetchType: 'active',
      })
    },
  })
}

export function useDeleteMerchantMutation(filters: MerchantFilters) {
  const queryClient = useQueryClient()
  const key = merchantsInfiniteKey(filters)

  return useMutation({
    mutationFn: (merchantId: string) => deleteMerchant(merchantId),
    onMutate: async (merchantId) => {
      await queryClient.cancelQueries({ queryKey: key })

      const previous =
        queryClient.getQueryData<InfiniteData<MerchantListResponse>>(key)

      queryClient.setQueryData<InfiniteData<MerchantListResponse>>(
        key,
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              merchants: page.merchants.filter((m) => m.id !== merchantId),
              totalCount: page.totalCount - 1,
            })),
          }
        },
      )

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

  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteMerchants(ids),
    onSuccess: () => {
      toast.success('Merchants deleted.')
      queryClient.invalidateQueries({ queryKey: MERCHANTS_KEY })
    },
    onError: () => {
      toast.error('Failed to delete merchants.')
    },
  })
}

export function useBulkPriorityMutation(filters: MerchantFilters) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ ids, priority }: { ids: string[]; priority: Priority }) =>
      bulkUpdatePriority(ids, priority),
    onSuccess: () => {
      toast.success('Priority updated for selected merchants.')
      queryClient.invalidateQueries({ queryKey: MERCHANTS_KEY })
    },
    onError: () => {
      toast.error('Failed to update priority.')
    },
  })
}
