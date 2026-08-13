import { createContext, use, useCallback, useMemo, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'

import { useAuth } from '#/features/auth/auth-client'
import {
  MERCHANTS_KEY,
  merchantsInfiniteQueryOptions,
  useBulkPriorityMutation,
  useBulkTerminateMutation,
  useTerminateMerchantMutation,
  useUpdatePriorityMutation,
} from '#/hooks/use-merchants-query'
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import type {
  MerchantFilters,
  MerchantListItem,
  MerchantRouteSearch,
  MerchantSortableColumn,
  Priority,
} from '#/schemas/merchants.schema'
import { DEFAULT_MERCHANT_STATUS_FILTER } from '#/schemas/merchants.schema'
import type { RoleType } from '#/types/auth'
import { createMerchantColumns } from './merchants-columns'
import type { MerchantPriorityTarget } from './merchants-priority-dialog'
import type { TerminateTarget } from './merchants-terminate-dialog'

interface MerchantsTableState {
  flatData: MerchantListItem[]
  selectedIds: string[]
  filters: MerchantRouteSearch
  userRole: RoleType
  isLoading: boolean
  loadedCount: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  priorityTarget: MerchantPriorityTarget | null
  terminateTarget: TerminateTarget | null
  isPriorityPending: boolean
  isTerminatePending: boolean
  isBulkPriorityPending: boolean
}

interface MerchantsTableActions {
  setFilter: (key: keyof MerchantRouteSearch, value: string | undefined) => void
  fetchNextPage: () => void
  openPriorityDialog: (merchant: MerchantListItem) => void
  closePriorityDialog: () => void
  openBulkPriorityDialog: () => void
  openTerminateDialog: (target: TerminateTarget) => void
  closeTerminateDialog: () => void
  submitPriority: (priority: Priority, note?: string) => void
  confirmTerminate: (reason: string) => void
}

interface MerchantsTableMeta {
  columns: DataTableColumnDef<MerchantListItem>[]
  selectedIdSet: Set<string>
  commaToSet: (value: string | undefined) => Set<string>
  setToCommaString: (set: Set<string>) => string | undefined
}

const MerchantsTableStateContext = createContext<MerchantsTableState | null>(
  null,
)
const MerchantsTableActionsContext =
  createContext<MerchantsTableActions | null>(null)
const MerchantsTableMetaContext = createContext<MerchantsTableMeta | null>(null)

function useRequiredContext<T>(context: React.Context<T | null>) {
  const value = use(context)

  if (!value) {
    throw new Error(
      'useMerchantsTable must be used within MerchantsTable.Provider',
    )
  }

  return value
}

export function useMerchantsTableState() {
  return useRequiredContext(MerchantsTableStateContext)
}

export function useMerchantsTableActions() {
  return useRequiredContext(MerchantsTableActionsContext)
}

export function useMerchantsTableMeta() {
  return useRequiredContext(MerchantsTableMetaContext)
}

export function useMerchantsTable() {
  return {
    state: useMerchantsTableState(),
    actions: useMerchantsTableActions(),
    meta: useMerchantsTableMeta(),
  }
}

function cleanEmptyParams(search: Record<string, unknown>) {
  const cleaned = { ...search }

  for (const key of Object.keys(cleaned)) {
    const value = cleaned[key]

    if (
      value === undefined ||
      value === '' ||
      (typeof value === 'number' && Number.isNaN(value))
    ) {
      delete cleaned[key]
    }
  }

  return cleaned
}

const routeApi = getRouteApi('/_app/merchants')

function useMerchantFilters() {
  const navigate = useNavigate()
  const filters = routeApi.useSearch()

  const setFilters = useCallback(
    (partialFilters: Partial<MerchantRouteSearch>) => {
      void navigate({
        to: '/merchants',
        search: (prev) =>
          cleanEmptyParams({
            ...prev,
            ...partialFilters,
          }) as MerchantRouteSearch,
        replace: true,
      })
    },
    [navigate],
  )

  const setFilter = useCallback(
    (key: keyof MerchantRouteSearch, value: string | undefined) => {
      setFilters({ [key]: value || undefined })
    },
    [setFilters],
  )

  return { filters, setFilters, setFilter }
}

function MerchantsTableProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userRole = user?.roleType ?? 'agent'
  const { filters, setFilter, setFilters } = useMerchantFilters()

  const handleSort = useCallback(
    (columnId: MerchantSortableColumn) => {
      const isSameColumn = filters.sortBy === columnId
      const nextOrder =
        isSameColumn && filters.sortOrder === 'asc' ? 'desc' : 'asc'

      if (!isSameColumn) {
        queryClient.removeQueries({ queryKey: MERCHANTS_KEY })
      }

      setFilters({ sortBy: columnId, sortOrder: nextOrder })
    },
    [filters.sortBy, filters.sortOrder, queryClient, setFilters],
  )

  const [selectedIdSet, setSelectedIdSet] = useState<Set<string>>(new Set())
  const [priorityTarget, setPriorityTarget] =
    useState<MerchantPriorityTarget | null>(null)
  const [terminateTarget, setTerminateTarget] =
    useState<TerminateTarget | null>(null)
  const queryFilters = useMemo<MerchantFilters>(
    () => ({
      ...filters,
      status: filters.status ?? DEFAULT_MERCHANT_STATUS_FILTER,
      createdAtFrom: undefined,
      createdAtTo: undefined,
    }),
    [filters],
  )

  const {
    data,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(merchantsInfiniteQueryOptions(queryFilters))

  const isTableLoading = isLoading || (isFetching && !isFetchingNextPage)

  const updatePriority = useUpdatePriorityMutation()
  const terminateMerchant = useTerminateMerchantMutation()
  const bulkTerminate = useBulkTerminateMutation()
  const bulkPriority = useBulkPriorityMutation()

  const flatData = useMemo(
    () => data?.pages.flatMap((page) => page.merchants) ?? [],
    [data],
  )
  const loadedCount = flatData.length
  const allIds = useMemo(
    () => flatData.map((merchant) => merchant.id),
    [flatData],
  )

  const handleSelectRow = useCallback((id: string, selected: boolean) => {
    setSelectedIdSet((prev) => {
      const next = new Set(prev)

      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }

      return next
    })
  }, [])

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      setSelectedIdSet(selected ? new Set(allIds) : new Set())
    },
    [allIds],
  )

  const selectedIds = useMemo(() => Array.from(selectedIdSet), [selectedIdSet])

  const columns = useMemo(
    () =>
      createMerchantColumns({
        userRole,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        onSort: handleSort,
        selectedIds: selectedIdSet,
        allIds,
        onSelectRow: handleSelectRow,
        onSelectAll: handleSelectAll,
        onPriorityClick: (merchant) =>
          setPriorityTarget({ type: 'single', merchant }),
        onTerminateClick: (merchant) =>
          setTerminateTarget({ type: 'single', merchant }),
      }),
    [
      allIds,
      filters.sortBy,
      filters.sortOrder,
      handleSelectAll,
      handleSelectRow,
      handleSort,
      selectedIdSet,
      userRole,
    ],
  )

  const commaToSet = useCallback(
    (value: string | undefined) =>
      new Set(value?.split(',').filter(Boolean) ?? []),
    [],
  )

  const setToCommaString = useCallback(
    (set: Set<string>) =>
      set.size > 0 ? Array.from(set).join(',') : undefined,
    [],
  )

  const submitPriority = useCallback(
    (priority: Priority, note?: string) => {
      if (!priorityTarget) {
        return
      }

      if (priorityTarget.type === 'bulk') {
        bulkPriority.mutate(
          { ids: priorityTarget.ids, priority, note },
          {
            onSuccess: () => {
              setPriorityTarget(null)
              setSelectedIdSet(new Set())
            },
          },
        )

        return
      }

      updatePriority.mutate(
        { merchantId: priorityTarget.merchant.id, priority, note },
        { onSuccess: () => setPriorityTarget(null) },
      )
    },
    [bulkPriority, priorityTarget, updatePriority],
  )

  const confirmTerminate = useCallback(
    (reason: string) => {
      if (!terminateTarget) {
        return
      }

      if (terminateTarget.type === 'single') {
        terminateMerchant.mutate(
          { merchantId: terminateTarget.merchant.id, reason },
          {
            onSuccess: () => {
              setTerminateTarget(null)
              setSelectedIdSet(new Set())
            },
          },
        )

        return
      }

      bulkTerminate.mutate(
        { ids: terminateTarget.ids, reason },
        {
          onSuccess: () => {
            setTerminateTarget(null)
            setSelectedIdSet(new Set())
          },
        },
      )
    },
    [bulkTerminate, terminateMerchant, terminateTarget],
  )

  const handleFetchNextPage = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const stateValue = useMemo<MerchantsTableState>(
    () => ({
      flatData,
      selectedIds,
      filters,
      userRole,
      isLoading: isTableLoading,
      loadedCount,
      hasNextPage,
      isFetchingNextPage,
      priorityTarget,
      terminateTarget,
      isPriorityPending: updatePriority.isPending,
      isTerminatePending:
        terminateMerchant.isPending || bulkTerminate.isPending,
      isBulkPriorityPending: bulkPriority.isPending,
    }),
    [
      bulkPriority.isPending,
      bulkTerminate.isPending,
      filters,
      flatData,
      hasNextPage,
      isFetchingNextPage,
      isTableLoading,
      priorityTarget,
      selectedIds,
      terminateMerchant.isPending,
      terminateTarget,
      loadedCount,
      updatePriority.isPending,
      userRole,
    ],
  )

  const actionsValue = useMemo<MerchantsTableActions>(
    () => ({
      setFilter,
      fetchNextPage: handleFetchNextPage,
      openPriorityDialog: (merchant) =>
        setPriorityTarget({ type: 'single', merchant }),
      closePriorityDialog: () => setPriorityTarget(null),
      openBulkPriorityDialog: () =>
        setPriorityTarget({
          type: 'bulk',
          ids: selectedIds,
          initialPriority: 'normal',
        }),
      openTerminateDialog: setTerminateTarget,
      closeTerminateDialog: () => setTerminateTarget(null),
      submitPriority,
      confirmTerminate,
    }),
    [
      confirmTerminate,
      handleFetchNextPage,
      setFilter,
      selectedIds,
      submitPriority,
    ],
  )

  const metaValue = useMemo<MerchantsTableMeta>(
    () => ({
      columns,
      selectedIdSet,
      commaToSet,
      setToCommaString,
    }),
    [columns, commaToSet, selectedIdSet, setToCommaString],
  )

  return (
    <MerchantsTableStateContext value={stateValue}>
      <MerchantsTableActionsContext value={actionsValue}>
        <MerchantsTableMetaContext value={metaValue}>
          {children}
        </MerchantsTableMetaContext>
      </MerchantsTableActionsContext>
    </MerchantsTableStateContext>
  )
}

export { MerchantsTableProvider }
