import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'

import { useAuth } from '#/features/auth/auth-client'
import {
  MERCHANTS_KEY,
  merchantsInfiniteQueryOptions,
  useBulkDeleteMutation,
  useBulkPriorityMutation,
  useDeleteMerchantMutation,
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
import type { RoleType } from '#/types/auth'
import { createMerchantColumns } from './merchants-columns'

export type DeleteTarget =
  | { type: 'single'; merchant: MerchantListItem }
  | { type: 'bulk'; ids: string[] }

interface MerchantsTableState {
  flatData: MerchantListItem[]
  selectedIds: string[]
  filters: MerchantRouteSearch
  userRole: RoleType
  isLoading: boolean
  loadedCount: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  priorityDialogMerchant: MerchantListItem | null
  deleteTarget: DeleteTarget | null
  bulkPriorityValue: Priority
  isPriorityPending: boolean
  isDeletePending: boolean
  isBulkPriorityPending: boolean
}

interface MerchantsTableActions {
  setFilter: (key: keyof MerchantRouteSearch, value: string | undefined) => void
  fetchNextPage: () => void
  openPriorityDialog: (merchant: MerchantListItem) => void
  closePriorityDialog: () => void
  openDeleteDialog: (target: DeleteTarget) => void
  closeDeleteDialog: () => void
  setBulkPriorityValue: (value: Priority) => void
  submitPriority: (merchantId: string, priority: Priority, note?: string) => void
  confirmDelete: () => void
  submitBulkPriority: () => void
}

interface MerchantsTableMeta {
  columns: DataTableColumnDef<MerchantListItem>[]
  selectedIdSet: Set<string>
  commaToSet: (value: string | undefined) => Set<string>
  setToCommaString: (set: Set<string>) => string | undefined
}

const MerchantsTableStateContext = createContext<MerchantsTableState | null>(null)
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
  const filters = routeApi.useSearch() as MerchantRouteSearch

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
  const userRole = user?.roleType ?? 'employee'
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
  const [priorityDialogMerchant, setPriorityDialogMerchant] =
    useState<MerchantListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [bulkPriorityValue, setBulkPriorityValue] =
    useState<Priority>('normal')
  const queryFilters = useMemo<MerchantFilters>(
    () => ({
      ...filters,
      createdAtFrom: undefined,
      createdAtTo: undefined,
    }),
    [filters],
  )

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(merchantsInfiniteQueryOptions(queryFilters))

  const updatePriority = useUpdatePriorityMutation()
  const deleteMerchant = useDeleteMerchantMutation(queryFilters)
  const bulkDelete = useBulkDeleteMutation()
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
        onPriorityClick: setPriorityDialogMerchant,
        onDeleteClick: (merchant) =>
          setDeleteTarget({ type: 'single', merchant }),
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
    (merchantId: string, priority: Priority, note?: string) => {
      updatePriority.mutate(
        { merchantId, priority, note },
        { onSuccess: () => setPriorityDialogMerchant(null) },
      )
    },
    [updatePriority],
  )

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) {
      return
    }

    if (deleteTarget.type === 'single') {
      deleteMerchant.mutate(deleteTarget.merchant.id, {
        onSuccess: () => {
          setDeleteTarget(null)
          setSelectedIdSet(new Set())
        },
      })

      return
    }

    bulkDelete.mutate(deleteTarget.ids, {
      onSuccess: () => {
        setDeleteTarget(null)
        setSelectedIdSet(new Set())
      },
    })
  }, [bulkDelete, deleteMerchant, deleteTarget])

  const submitBulkPriority = useCallback(() => {
    bulkPriority.mutate(
      { ids: selectedIds, priority: bulkPriorityValue },
      { onSuccess: () => setSelectedIdSet(new Set()) },
    )
  }, [bulkPriority, bulkPriorityValue, selectedIds])

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
      isLoading,
      loadedCount,
      hasNextPage,
      isFetchingNextPage,
      priorityDialogMerchant,
      deleteTarget,
      bulkPriorityValue,
      isPriorityPending: updatePriority.isPending,
      isDeletePending: deleteMerchant.isPending || bulkDelete.isPending,
      isBulkPriorityPending: bulkPriority.isPending,
    }),
    [
      bulkDelete.isPending,
      bulkPriority.isPending,
      bulkPriorityValue,
      deleteMerchant.isPending,
      deleteTarget,
      filters,
      flatData,
      hasNextPage,
      isFetchingNextPage,
      isLoading,
      priorityDialogMerchant,
      selectedIds,
      loadedCount,
      updatePriority.isPending,
      userRole,
    ],
  )

  const actionsValue = useMemo<MerchantsTableActions>(
    () => ({
      setFilter,
      fetchNextPage: handleFetchNextPage,
      openPriorityDialog: setPriorityDialogMerchant,
      closePriorityDialog: () => setPriorityDialogMerchant(null),
      openDeleteDialog: setDeleteTarget,
      closeDeleteDialog: () => setDeleteTarget(null),
      setBulkPriorityValue,
      submitPriority,
      confirmDelete,
      submitBulkPriority,
    }),
    [
      confirmDelete,
      handleFetchNextPage,
      setBulkPriorityValue,
      setFilter,
      submitBulkPriority,
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
