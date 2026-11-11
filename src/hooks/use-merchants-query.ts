import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  FetchQueryOptions,
  InfiniteData,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { getApiErrorMessage } from '#/lib/get-api-error-message'

import {
  bulkUpdatePriority,
  deleteMerchantDriveFiles,
  fetchMerchantForm,
  fetchMerchantHeader,
  fetchMerchantHistory,
  fetchMerchantLimits,
  fetchMerchantOverview,
  fetchMerchants,
  bulkTerminateMerchants,
  permanentlyDeleteMerchant,
  resetMerchantLimitsMdr,
  terminateMerchant,
  updateMerchantLimitsMdr,
  updateMerchantPriority,
} from '#/apis/merchants'
import type {
  MerchantFilters,
  MerchantLimitsMdr,
  MerchantListItem,
  MerchantListResponse,
  Priority,
} from '#/schemas/merchants.schema'

export const MERCHANTS_KEY = ['merchants'] as const
export const MERCHANTS_PAGE_SIZE = 30
export const MERCHANT_OPTIONS_KEY = ['merchants', 'options'] as const

/** Build a stable infinite-query key from filters. */
export function merchantsInfiniteKey(filters: MerchantFilters) {
  return [...MERCHANTS_KEY, filters] as const
}

export function merchantsInfiniteQueryOptions(filters: MerchantFilters) {
  return infiniteQueryOptions({
    queryKey: merchantsInfiniteKey(filters),
    queryFn: ({ pageParam }) =>
      fetchMerchants({
        ...filters,
        cursor: pageParam,
        limit: MERCHANTS_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** `status`: comma-separated filter; omit to list every status. */
export function merchantOptionsQueryOptions(search = '', status?: string) {
  return queryOptions({
    queryKey: [...MERCHANT_OPTIONS_KEY, search, status ?? 'all'],
    queryFn: () =>
      fetchMerchants({
        search,
        status,
        priority: undefined,
        businessScope: undefined,
        currency: undefined,
        epStatus: undefined,
        sortBy: 'merchantNumber',
        sortOrder: 'desc',
        createdAtFrom: undefined,
        createdAtTo: undefined,
        limit: 50,
      }),
    // Keep the current options listed while a new search term loads.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function merchantDetailKey(merchantId: string) {
  return [...MERCHANTS_KEY, 'detail', merchantId] as const
}

export function merchantHeaderQueryOptions(merchantId: string) {
  return queryOptions({
    queryKey: [...merchantDetailKey(merchantId), 'header'] as const,
    queryFn: () => fetchMerchantHeader(merchantId),
    staleTime: 30_000,
  })
}

export function merchantOverviewQueryOptions(merchantId: string) {
  return queryOptions({
    queryKey: [...merchantDetailKey(merchantId), 'overview'] as const,
    queryFn: () => fetchMerchantOverview(merchantId),
    staleTime: 30_000,
  })
}

export function merchantFormQueryOptions(merchantId: string) {
  return queryOptions({
    queryKey: [...merchantDetailKey(merchantId), 'form'] as const,
    queryFn: () => fetchMerchantForm(merchantId),
    staleTime: 30_000,
  })
}

export function merchantLimitsQueryOptions(merchantId: string) {
  return queryOptions({
    queryKey: [...merchantDetailKey(merchantId), 'limits'] as const,
    queryFn: () => fetchMerchantLimits(merchantId),
    staleTime: 30_000,
  })
}

export function merchantHistoryQueryOptions(merchantId: string) {
  return queryOptions({
    queryKey: [...merchantDetailKey(merchantId), 'history'] as const,
    queryFn: () => fetchMerchantHistory(merchantId),
    staleTime: 30_000,
  })
}

/**
 * A merchant tab's route loader: the tab's request starts as the tab is
 * clicked, alongside its skeleton, and a failed request lands in the tab's
 * error boundary. Hover preloads don't fetch.
 */
export async function loadMerchantSection<TData, TQueryKey extends QueryKey>(
  queryClient: QueryClient,
  options: FetchQueryOptions<TData, Error, TData, TQueryKey>,
  preload: boolean,
) {
  if (preload) return
  await queryClient.ensureQueryData(options)
}

export function useUpdateMerchantLimitsMdrMutation(merchantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: MerchantLimitsMdr) =>
      updateMerchantLimitsMdr(merchantId, input),
    onSuccess: () => {
      toast.success('Limits and MDR updated for this merchant.')
      queryClient.invalidateQueries({
        queryKey: merchantDetailKey(merchantId),
      })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update limits and MDR.'))
    },
  })
}

export function useResetMerchantLimitsMdrMutation(merchantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => resetMerchantLimitsMdr(merchantId),
    onSuccess: () => {
      toast.success('Reverted to global limits and MDR.')
      queryClient.invalidateQueries({
        queryKey: merchantDetailKey(merchantId),
      })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to reset limits and MDR.'))
    },
  })
}

function updateMerchantInMerchantLists(
  queryClient: ReturnType<typeof useQueryClient>,
  merchantId: string,
  updater: (merchant: MerchantListItem) => MerchantListItem,
) {
  queryClient.setQueriesData<InfiniteData<MerchantListResponse>>(
    { queryKey: MERCHANTS_KEY },
    (old) => {
      if (!old || !Array.isArray(old.pages)) return old
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

export function useUpdatePriorityMutation() {
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

      const previous = queryClient.getQueriesData<
        InfiniteData<MerchantListResponse>
      >({
        queryKey: MERCHANTS_KEY,
      })

      updateMerchantInMerchantLists(queryClient, merchantId, (merchant) => ({
        ...merchant,
        priority,
        priorityNote: note ?? null,
      }))

      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        for (const [queryKey, data] of context.previous) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      toast.error(getApiErrorMessage(error, 'Failed to update priority.'))
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

export function useTerminateMerchantMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      merchantId,
      reason,
      deleteDriveFiles,
    }: {
      merchantId: string
      reason: string
      deleteDriveFiles: boolean
    }) => terminateMerchant(merchantId, reason, deleteDriveFiles),
    onMutate: async ({ merchantId }) => {
      await queryClient.cancelQueries({ queryKey: MERCHANTS_KEY })

      const previous = queryClient.getQueriesData<
        InfiniteData<MerchantListResponse>
      >({
        queryKey: MERCHANTS_KEY,
      })

      updateMerchantInMerchantLists(queryClient, merchantId, (merchant) => ({
        ...merchant,
        status: 'terminated',
      }))

      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        for (const [queryKey, data] of context.previous) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      toast.error(getApiErrorMessage(error, 'Failed to terminate merchant.'))
    },
    onSuccess: ({ driveFiles }) => {
      // The merchant is terminated either way; only the Drive step can fail.
      if (driveFiles?.status === 'failed') {
        toast.warning(
          `Merchant terminated, but its Drive files were not moved to trash: ${driveFiles.message} You can retry from the merchants list.`,
        )
        return
      }
      toast.success(
        driveFiles
          ? 'Merchant terminated and Google Drive files moved to trash.'
          : 'Merchant terminated.',
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MERCHANTS_KEY })
    },
  })
}

export function useDeleteMerchantDriveFilesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (merchantId: string) => deleteMerchantDriveFiles(merchantId),
    onSuccess: () => {
      toast.success('Google Drive files moved to trash.')
      queryClient.invalidateQueries({ queryKey: MERCHANTS_KEY })
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(
          error,
          'Failed to move Google Drive files to trash.',
        ),
      )
    },
  })
}

export function usePermanentlyDeleteMerchantMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      merchantId,
      confirmation,
    }: {
      merchantId: string
      confirmation: string
    }) => permanentlyDeleteMerchant(merchantId, confirmation),
    onSuccess: ({ id }) => {
      queryClient.removeQueries({ queryKey: merchantDetailKey(id) })
      toast.success('Merchant and all associated data deleted.')
      queryClient.invalidateQueries({ queryKey: MERCHANTS_KEY })
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to permanently delete merchant.'),
      )
    },
  })
}

export function useBulkTerminateMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      ids,
      reason,
      deleteDriveFiles,
    }: {
      ids: string[]
      reason: string
      deleteDriveFiles: boolean
    }) => bulkTerminateMerchants(ids, reason, deleteDriveFiles),
    onSuccess: ({ driveFilesQueuedCount }) => {
      toast.success(
        driveFilesQueuedCount > 0
          ? 'Selected merchants terminated. Their Drive files are moving to trash in the background.'
          : 'Selected merchants terminated.',
      )
      queryClient.invalidateQueries({ queryKey: MERCHANTS_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to terminate merchants.'))
    },
  })
}

export function useBulkPriorityMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      ids,
      priority,
      note,
    }: {
      ids: string[]
      priority: Priority
      note?: string
    }) => bulkUpdatePriority(ids, priority, note),
    onSuccess: () => {
      toast.success('Priority updated for selected merchants.')
      queryClient.invalidateQueries({ queryKey: MERCHANTS_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update priority.'))
    },
  })
}
