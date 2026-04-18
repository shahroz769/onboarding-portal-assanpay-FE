import { useCallback, useMemo, useState } from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { AlertTriangleIcon, Trash2Icon } from 'lucide-react'

import { useAuth } from '#/features/auth/auth-client'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { TooltipProvider } from '#/components/ui/tooltip'
import {
  DataTable,
  DataTableFilter,
  DataTableSearch,
  DataTableSelectionInfo,
  DataTableToolbar,
  DataTableViewOptions,
} from '#/components/data-table'
import {
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
import {
  ONBOARDING_STAGES,
  ONBOARDING_STAGE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  BUSINESS_SCOPES,
  BUSINESS_SCOPE_LABELS,
} from '#/schemas/merchants.schema'
import { createMerchantColumns } from './merchants-columns'
import { MerchantPriorityDialog } from './merchants-priority-dialog'
import { MerchantDeleteDialog } from './merchants-delete-dialog'

// ─── Filter Option Configs ──────────────────────────────────────────────────

const stageFilterOptions = ONBOARDING_STAGES.map((s) => ({
  label: ONBOARDING_STAGE_LABELS[s],
  value: s,
}))

const priorityFilterOptions = PRIORITIES.map((p) => ({
  label: PRIORITY_LABELS[p],
  value: p,
}))

const scopeFilterOptions = BUSINESS_SCOPES.map((s) => ({
  label: BUSINESS_SCOPE_LABELS[s],
  value: s,
}))

// ─── Main Component ─────────────────────────────────────────────────────────

interface MerchantsTableProps {
  filters: MerchantFilters
  onFiltersChange: (filters: MerchantFilters) => void
}

export function MerchantsTable({
  filters,
  onFiltersChange,
}: MerchantsTableProps) {
  const { user } = useAuth()
  const userRole = user?.roleType ?? 'employee'

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Dialog state
  const [priorityDialogMerchant, setPriorityDialogMerchant] =
    useState<MerchantListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'single' | 'bulk'
    merchant?: MerchantListItem
    ids?: string[]
  } | null>(null)
  const [bulkPriorityValue, setBulkPriorityValue] = useState<Priority>('normal')

  // Query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMerchantsInfiniteQuery(filters)

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
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    manualSorting: false,
  })

  // Filter helpers
  const setFilter = useCallback(
    (key: keyof MerchantFilters, value: string | undefined) => {
      onFiltersChange({ ...filters, [key]: value || undefined })
    },
    [filters, onFiltersChange],
  )

  const setToCommaString = (set: Set<string>) =>
    set.size > 0 ? Array.from(set).join(',') : undefined

  const commaToSet = (value: string | undefined) =>
    new Set(value?.split(',').filter(Boolean) ?? [])

  // Selected row IDs
  const selectedIds = useMemo(
    () =>
      table
        .getFilteredSelectedRowModel()
        .rows.map((r) => r.original.id),
    [table, rowSelection],
  )

  // Handlers
  const handlePrioritySubmit = (
    merchantId: string,
    priority: Priority,
    note?: string,
  ) => {
    updatePriority.mutate(
      { merchantId, priority, note },
      { onSuccess: () => setPriorityDialogMerchant(null) },
    )
  }

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return

    if (deleteTarget.type === 'single' && deleteTarget.merchant) {
      deleteMerchant.mutate(deleteTarget.merchant.id, {
        onSuccess: () => {
          setDeleteTarget(null)
          setRowSelection({})
        },
      })
    } else if (deleteTarget.type === 'bulk' && deleteTarget.ids) {
      bulkDelete.mutate(deleteTarget.ids, {
        onSuccess: () => {
          setDeleteTarget(null)
          setRowSelection({})
        },
      })
    }
  }

  const handleBulkPriority = () => {
    bulkPriority.mutate(
      { ids: selectedIds, priority: bulkPriorityValue },
      {
        onSuccess: () => {
          setRowSelection({})
        },
      },
    )
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        {/* Toolbar */}
        <DataTableToolbar>
          <DataTableToolbar.Filters>
            <DataTableSearch
              value={filters.search ?? ''}
              onChange={(v) => setFilter('search', v || undefined)}
              placeholder="Search by ID or name..."
            />
            <DataTableFilter
              title="Stage"
              options={stageFilterOptions}
              selectedValues={commaToSet(filters.onboardingStage)}
              onChange={(set) =>
                setFilter('onboardingStage', setToCommaString(set))
              }
            />
            <DataTableFilter
              title="Priority"
              options={priorityFilterOptions}
              selectedValues={commaToSet(filters.priority)}
              onChange={(set) => setFilter('priority', setToCommaString(set))}
            />
            <DataTableFilter
              title="Scope"
              options={scopeFilterOptions}
              selectedValues={commaToSet(filters.businessScope)}
              onChange={(set) =>
                setFilter('businessScope', setToCommaString(set))
              }
            />
          </DataTableToolbar.Filters>
          <DataTableToolbar.Actions>
            {selectedIds.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} of {flatData.length} row(s) selected
              </span>
            )}
            <DataTableViewOptions table={table} />
          </DataTableToolbar.Actions>
        </DataTableToolbar>

        {/* Selection Info — between toolbar and table */}
        <DataTableSelectionInfo table={table}>
          {(userRole === 'admin' || userRole === 'supervisor') && (
            <div className="flex items-center gap-2">
              <Select
                value={bulkPriorityValue}
                onValueChange={(v) => setBulkPriorityValue(v as Priority)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkPriority}
                disabled={bulkPriority.isPending}
              >
                <AlertTriangleIcon data-icon="inline-start" />
                Set Priority
              </Button>
            </div>
          )}
          {userRole === 'admin' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                setDeleteTarget({ type: 'bulk', ids: selectedIds })
              }
              disabled={bulkDelete.isPending}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete ({selectedIds.length})
            </Button>
          )}
        </DataTableSelectionInfo>

        {/* Table */}
        <DataTable
          table={table}
          columnCount={columns.length}
          onLoadMore={fetchNextPage}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          isLoading={isLoading}
        />

        {/* Priority Dialog */}
        <MerchantPriorityDialog
          merchant={priorityDialogMerchant}
          open={priorityDialogMerchant !== null}
          onOpenChange={(open) => {
            if (!open) setPriorityDialogMerchant(null)
          }}
          onSubmit={handlePrioritySubmit}
          isPending={updatePriority.isPending}
        />

        {/* Delete Dialog */}
        <MerchantDeleteDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          onConfirm={handleDeleteConfirm}
          isPending={deleteMerchant.isPending || bulkDelete.isPending}
          description={
            deleteTarget?.type === 'single'
              ? `Are you sure you want to delete "${deleteTarget.merchant?.businessName}"? This action cannot be undone.`
              : `Are you sure you want to delete ${deleteTarget?.ids?.length ?? 0} merchant(s)? This action cannot be undone.`
          }
        />
      </div>
    </TooltipProvider>
  )
}
