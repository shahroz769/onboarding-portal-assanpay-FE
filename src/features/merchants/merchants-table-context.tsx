import { createContext, startTransition, use, useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type {
  ColumnDef,
  RowSelectionState,
  SortingState,
  Table as TanstackTable,
  VisibilityState,
} from '@tanstack/react-table'

import { useAuth } from '#/features/auth/auth-client'
import {
  MERCHANTS_KEY,
  useMerchantsInfiniteQuery,
  useUpdatePriorityMutation,
  useDeleteMerchantMutation,
  useBulkDeleteMutation,
  useBulkPriorityMutation,
} from '#/hooks/use-merchants-query'
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
  fetchNextPage: () => void
  setFilter: (key: keyof MerchantFilters, value: string | undefined) => void
  openPriorityDialog: (merchant: MerchantListItem) => void
  closePriorityDialog: () => void
  openDeleteDialog: (target: DeleteTarget) => void
  closeDeleteDialog: () => void
  setBulkPriorityValue: (value: Priority) => void
  submitPriority: (
    merchantId: string,
    priority: Priority,
    note?: string,
  ) => void
  confirmDelete: () => void
  submitBulkPriority: () => void
}

interface MerchantsTableMeta {
  table: TanstackTable<MerchantListItem>
  columns: ColumnDef<MerchantListItem>[]
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
      'useMerchantsTable must be used within MerchantsTableProvider',
    )
  }
  return ctx
}

// ─── Provider ───────────────────────────────────────────────────────────────

interface MerchantsTableProviderProps {
  filters: MerchantFilters
  onFiltersChange: (filters: MerchantFilters) => void
  children: React.ReactNode
}

export function MerchantsTableProvider({
  filters,
  onFiltersChange,
  children,
}: MerchantsTableProviderProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userRole = user?.roleType ?? 'employee'

  // Table state — sorting is server-driven via filters
  const sorting: SortingState = filters.sortBy
    ? [{ id: filters.sortBy, desc: filters.sortOrder === 'desc' }]
    : []

  const handleSortingChange = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      const nextSort = next.length > 0 ? next[0] : undefined
      const nextFilters = {
        ...filters,
        sortBy: nextSort?.id,
        sortOrder: nextSort ? (nextSort.desc ? 'desc' : 'asc') : undefined,
      }
      const didSortChange =
        filters.sortBy !== nextFilters.sortBy ||
        filters.sortOrder !== nextFilters.sortOrder

      if (didSortChange) {
        queryClient.removeQueries({ queryKey: MERCHANTS_KEY })
      }

      startTransition(() => {
        onFiltersChange(nextFilters)
      })
    },
    [filters, onFiltersChange, queryClient, sorting],
  )

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Dialog state
  const [priorityDialogMerchant, setPriorityDialogMerchant] =
    useState<MerchantListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [bulkPriorityValue, setBulkPriorityValue] =
    useState<Priority>('normal')

  // Query
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMerchantsInfiniteQuery(filters)

  // Mutations
  const updatePriority = useUpdatePriorityMutation(filters)
  const deleteMerchant = useDeleteMerchantMutation(filters)
  const bulkDelete = useBulkDeleteMutation(filters)
  const bulkPriority = useBulkPriorityMutation(filters)

  // Flatten infinite pages
  const flatData = useMemo(
    () => data?.pages.flatMap((p) => p.merchants) ?? [],
    [data],
  )

  // Column factory
  const columns = useMemo(
    () =>
      createMerchantColumns({
        userRole,
        onPriorityClick: (m) => setPriorityDialogMerchant(m),
        onDeleteClick: (m) =>
          setDeleteTarget({ type: 'single', merchant: m }),
      }),
    [userRole],
  )

  const table = useReactTable({
    data: flatData,
    columns,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
    manualSorting: true,
  })

  // Filter helpers
  const setFilter = useCallback(
    (key: keyof MerchantFilters, value: string | undefined) => {
      onFiltersChange({ ...filters, [key]: value || undefined })
    },
    [filters, onFiltersChange],
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

  // Selected row IDs
  const selectedIds = useMemo(
    () =>
      table.getFilteredSelectedRowModel().rows.map((r) => r.original.id),
    [table, rowSelection],
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
          setRowSelection({})
        },
      })
    } else {
      bulkDelete.mutate(deleteTarget.ids, {
        onSuccess: () => {
          setDeleteTarget(null)
          setRowSelection({})
        },
      })
    }
  }, [deleteTarget, deleteMerchant, bulkDelete])

  const submitBulkPriority = useCallback(() => {
    bulkPriority.mutate(
      { ids: selectedIds, priority: bulkPriorityValue },
      { onSuccess: () => setRowSelection({}) },
    )
  }, [bulkPriority, selectedIds, bulkPriorityValue])

  return (
    <MerchantsTableContext
      value={{
        state: {
          flatData,
          selectedIds,
          filters,
          userRole,
          isLoading,
          hasNextPage: Boolean(hasNextPage),
          isFetchingNextPage,
          priorityDialogMerchant,
          deleteTarget,
          bulkPriorityValue,
          isPriorityPending: updatePriority.isPending,
          isDeletePending: deleteMerchant.isPending || bulkDelete.isPending,
          isBulkPriorityPending: bulkPriority.isPending,
        },
        actions: {
          fetchNextPage,
          setFilter,
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
          table,
          columns,
          commaToSet,
          setToCommaString,
        },
      }}
    >
      {children}
    </MerchantsTableContext>
  )
}
