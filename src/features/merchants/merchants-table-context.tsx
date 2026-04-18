import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, getRouteApi } from '@tanstack/react-router'

import { useAuth } from '#/features/auth/auth-client'
import { fetchMerchants } from '#/apis/merchants'
import {
  useUpdatePriorityMutation,
  useDeleteMerchantMutation,
  useBulkDeleteMutation,
  useBulkPriorityMutation,
  MERCHANTS_KEY,
  merchantsInfiniteKey,
} from '#/hooks/use-merchants-query'
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import type {
  MerchantFilters,
  MerchantListItem,
  Priority,
} from '#/schemas/merchants.schema'
import type { RoleType } from '#/types/auth'
import { createMerchantColumns } from './merchants-columns'

// ─── Types ──────────────────────────────────────────────────────────────────

export type DeleteTarget =
  | { type: 'single'; merchant: MerchantListItem }
  | { type: 'bulk'; ids: string[] }

interface MerchantsTableState {
  flatData: MerchantListItem[]
  selectedIds: string[]
  filters: MerchantFilters
  userRole: RoleType
  isLoading: boolean
  totalCount: number
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
  setFilter: (key: keyof MerchantFilters, value: string | undefined) => void
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

interface MerchantsTableContextValue {
  state: MerchantsTableState
  actions: MerchantsTableActions
  meta: MerchantsTableMeta
}

// ─── Context ────────────────────────────────────────────────────────────────

const MerchantsTableContext =
  createContext<MerchantsTableContextValue | null>(null)

export function useMerchantsTable() {
  const ctx = use(MerchantsTableContext)
  if (!ctx) {
    throw new Error(
      'useMerchantsTable must be used within MerchantsTable.Provider',
    )
  }
  return ctx
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PER_PAGE = 30

function cleanEmptyParams(search: Record<string, unknown>) {
  const cleaned = { ...search }
  for (const key of Object.keys(cleaned)) {
    const value = cleaned[key]
    if (value === undefined || value === '' || (typeof value === 'number' && isNaN(value))) {
      delete cleaned[key]
    }
  }
  return cleaned
}

// ─── useFilters (TanStack Router search params pattern) ─────────────────────

const routeApi = getRouteApi('/_app/merchants')

function useMerchantFilters() {
  const navigate = useNavigate()
  const filters = routeApi.useSearch() as MerchantFilters

  const setFilters = useCallback(
    (partialFilters: Partial<MerchantFilters>) => {
      void navigate({
        to: '/merchants',
        search: (prev) =>
          cleanEmptyParams({ ...prev, ...partialFilters }) as MerchantFilters,
        replace: true,
      })
    },
    [navigate],
  )

  const setFilter = useCallback(
    (key: keyof MerchantFilters, value: string | undefined) => {
      setFilters({ [key]: value || undefined })
    },
    [setFilters],
  )

  return { filters, setFilters, setFilter }
}

// ─── Provider ───────────────────────────────────────────────────────────────

function MerchantsTableProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userRole = user?.roleType ?? 'employee'

  // TanStack Router search params as single source of truth
  const { filters, setFilter, setFilters } = useMerchantFilters()

  // Sort handler — toggles asc/desc or sets new column
  const handleSort = useCallback(
    (columnId: string) => {
      const isSameColumn = filters.sortBy === columnId
      const nextOrder =
        isSameColumn && filters.sortOrder === 'asc' ? 'desc' : 'asc'

      if (!isSameColumn) {
        queryClient.removeQueries({ queryKey: MERCHANTS_KEY })
      }

      setFilters({ sortBy: columnId, sortOrder: nextOrder })
    },
    [filters.sortBy, filters.sortOrder, setFilters, queryClient],
  )

  // Row selection as plain Set<string>
  const [selectedIdSet, setSelectedIdSet] = useState<Set<string>>(new Set())

  // Dialog state
  const [priorityDialogMerchant, setPriorityDialogMerchant] =
    useState<MerchantListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [bulkPriorityValue, setBulkPriorityValue] =
    useState<Priority>('normal')

  // Infinite query key (excludes page/perPage — managed by useInfiniteQuery)
  const infiniteKey = merchantsInfiniteKey(filters)

  // TanStack Query — infinite scroll
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: infiniteKey,
    queryFn: ({ pageParam }) =>
      fetchMerchants({
        ...filters,
        page: pageParam,
        perPage: PER_PAGE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  })

  // Mutations
  const updatePriority = useUpdatePriorityMutation(filters)
  const deleteMerchant = useDeleteMerchantMutation(filters)
  const bulkDelete = useBulkDeleteMutation(filters)
  const bulkPriority = useBulkPriorityMutation(filters)

  const flatData = useMemo(
    () => data?.pages.flatMap((page) => page.merchants) ?? [],
    [data],
  )

  const totalCount = data?.pages[0]?.totalCount ?? 0

  // All row IDs for select-all
  const allIds = useMemo(() => flatData.map((m) => m.id), [flatData])

  // Selection handlers
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

  // Selected IDs as array (derived)
  const selectedIds = useMemo(
    () => Array.from(selectedIdSet),
    [selectedIdSet],
  )

  // Column factory — recreated when sort/selection/role changes
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
        onPriorityClick: (m) => setPriorityDialogMerchant(m),
        onDeleteClick: (m) => setDeleteTarget({ type: 'single', merchant: m }),
      }),
    [userRole, filters.sortBy, filters.sortOrder, handleSort, selectedIdSet, allIds, handleSelectRow, handleSelectAll],
  )

  // Comma filter helpers
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

  // Actions
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
    if (!deleteTarget) return

    if (deleteTarget.type === 'single') {
      deleteMerchant.mutate(deleteTarget.merchant.id, {
        onSuccess: () => {
          setDeleteTarget(null)
          setSelectedIdSet(new Set())
        },
      })
    } else {
      bulkDelete.mutate(deleteTarget.ids, {
        onSuccess: () => {
          setDeleteTarget(null)
          setSelectedIdSet(new Set())
        },
      })
    }
  }, [deleteTarget, deleteMerchant, bulkDelete])

  const submitBulkPriority = useCallback(() => {
    bulkPriority.mutate(
      { ids: selectedIds, priority: bulkPriorityValue },
      { onSuccess: () => setSelectedIdSet(new Set()) },
    )
  }, [bulkPriority, selectedIds, bulkPriorityValue])

  const handleFetchNextPage = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const contextValue = useMemo<MerchantsTableContextValue>(
    () => ({
      state: {
        flatData,
        selectedIds,
        filters,
        userRole,
        isLoading,
        totalCount,
        hasNextPage: hasNextPage ?? false,
        isFetchingNextPage,
        priorityDialogMerchant,
        deleteTarget,
        bulkPriorityValue,
        isPriorityPending: updatePriority.isPending,
        isDeletePending: deleteMerchant.isPending || bulkDelete.isPending,
        isBulkPriorityPending: bulkPriority.isPending,
      },
      actions: {
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
      },
      meta: {
        columns,
        selectedIdSet,
        commaToSet,
        setToCommaString,
      },
    }),
    [
      flatData,
      selectedIds,
      filters,
      userRole,
      isLoading,
      totalCount,
      hasNextPage,
      isFetchingNextPage,
      priorityDialogMerchant,
      deleteTarget,
      bulkPriorityValue,
      updatePriority.isPending,
      deleteMerchant.isPending,
      bulkDelete.isPending,
      bulkPriority.isPending,
      setFilter,
      handleFetchNextPage,
      setBulkPriorityValue,
      submitPriority,
      confirmDelete,
      submitBulkPriority,
      columns,
      selectedIdSet,
      commaToSet,
      setToCommaString,
    ],
  )

  return (
    <MerchantsTableContext value={contextValue}>
      {children}
    </MerchantsTableContext>
  )
}

// Re-export for compound component attachment
export { MerchantsTableProvider }
