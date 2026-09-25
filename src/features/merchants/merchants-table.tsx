import { AlertTriangleIcon, BanIcon, Store } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/empty-state'
import { TooltipProvider } from '#/components/ui/tooltip'
import {
  DataTable,
  DataTableFilter,
  DataTableSearch,
  DataTableSelectionInfo,
  DataTableToolbar,
} from '#/components/data-table'
import {
  PRIORITIES,
  PRIORITY_LABELS,
  BUSINESS_SCOPES,
  BUSINESS_SCOPE_LABELS,
  DEFAULT_MERCHANT_STATUS_FILTER,
  MERCHANT_STATUSES,
  MERCHANT_STATUS_DISPLAY,
} from '#/schemas/merchants.schema'
import {
  MerchantsTableProvider,
  useMerchantsTableActions,
  useMerchantsTableMeta,
  useMerchantsTableState,
} from './merchants-table-context'
import { selectedNonTerminatedIds } from './merchants-table-utils'
import { MerchantPriorityDialog } from './merchants-priority-dialog'
import { useRetainedValue } from '#/hooks/use-retained-value'
import { MerchantTerminateDialog } from './merchants-terminate-dialog'
import { MerchantDeleteDialog } from './merchant-delete-dialog'

// ─── Filter Option Configs ──────────────────────────────────────────────────

const priorityFilterOptions = PRIORITIES.map((p) => ({
  label: PRIORITY_LABELS[p],
  value: p,
}))

const scopeFilterOptions = BUSINESS_SCOPES.map((s) => ({
  label: BUSINESS_SCOPE_LABELS[s],
  value: s,
}))

const statusFilterOptions = MERCHANT_STATUSES.map((status) => ({
  label: MERCHANT_STATUS_DISPLAY[status],
  value: status,
}))

// ─── Toolbar ────────────────────────────────────────────────────────────────

function Toolbar() {
  const state = useMerchantsTableState()
  const actions = useMerchantsTableActions()
  const meta = useMerchantsTableMeta()
  const { filters, selectedIds, flatData } = state

  return (
    <DataTableToolbar>
      <DataTableToolbar.Filters>
        <DataTableSearch
          value={filters.search ?? ''}
          onChange={(v) => actions.setFilter('search', v || undefined)}
          placeholder="Search by ID or name..."
        />
        <DataTableFilter
          title="Priority"
          options={priorityFilterOptions}
          selectedValues={meta.commaToSet(filters.priority)}
          onChange={(set) =>
            actions.setFilter('priority', meta.setToCommaString(set))
          }
        />
        <DataTableFilter
          title="Scope"
          options={scopeFilterOptions}
          selectedValues={meta.commaToSet(filters.businessScope)}
          onChange={(set) =>
            actions.setFilter('businessScope', meta.setToCommaString(set))
          }
        />
        <DataTableFilter
          title="Status"
          options={statusFilterOptions}
          selectedValues={meta.commaToSet(
            filters.status ?? DEFAULT_MERCHANT_STATUS_FILTER,
          )}
          onChange={(set) =>
            actions.setFilter('status', meta.setToCommaString(set))
          }
        />
      </DataTableToolbar.Filters>
      <DataTableToolbar.Actions>
        {selectedIds.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} of {flatData.length} row(s) selected
          </span>
        )}
      </DataTableToolbar.Actions>
    </DataTableToolbar>
  )
}

// ─── Bulk Actions ───────────────────────────────────────────────────────────

function BulkActions() {
  const state = useMerchantsTableState()
  const actions = useMerchantsTableActions()
  const canEditPriority =
    state.userRole === 'super_admin' || state.userRole === 'admin'
  const canTerminate =
    state.userRole === 'super_admin' || state.userRole === 'admin'
  const actionableIds = selectedNonTerminatedIds(
    state.selectedIds,
    state.flatData,
  )

  return (
    <DataTableSelectionInfo
      selectedCount={state.selectedIds.length}
      visibleCount={state.flatData.length}
    >
      {canEditPriority && actionableIds.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={actions.openBulkPriorityDialog}
          disabled={state.isBulkPriorityPending}
        >
          <AlertTriangleIcon data-icon="inline-start" />
          Set Priority ({actionableIds.length})
        </Button>
      )}
      {canTerminate && actionableIds.length > 0 && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() =>
            actions.openTerminateDialog({
              type: 'bulk',
              ids: actionableIds,
            })
          }
          disabled={state.isTerminatePending}
        >
          <BanIcon data-icon="inline-start" />
          Terminate ({actionableIds.length})
        </Button>
      )}
    </DataTableSelectionInfo>
  )
}

// ─── Data Grid ──────────────────────────────────────────────────────────────

function Grid() {
  const state = useMerchantsTableState()
  const actions = useMerchantsTableActions()
  const meta = useMerchantsTableMeta()

  return (
    <DataTable
      columns={meta.columns}
      data={state.flatData}
      getRowId={(m) => m.id}
      selectedIds={meta.selectedIdSet}
      isLoading={state.isLoading}
      onScrollEnd={actions.fetchNextPage}
      isFetchingMore={state.isFetchingNextPage}
      hasMore={state.hasNextPage}
      totalCount={state.totalCount}
      emptyContent={
        <EmptyState
          icon={Store}
          title="No merchants found."
          description="Try adjusting your search or filters."
        />
      }
    />
  )
}

// ─── Dialogs ────────────────────────────────────────────────────────────────

function Dialogs() {
  const state = useMerchantsTableState()
  const actions = useMerchantsTableActions()
  const priorityTarget = useRetainedValue(state.priorityTarget)
  const terminateTarget = useRetainedValue(state.terminateTarget)
  const deleteTarget = useRetainedValue(state.deleteTarget)

  return (
    <>
      {priorityTarget ? (
        <MerchantPriorityDialog
          target={priorityTarget}
          open={state.priorityTarget !== null}
          onOpenChange={(open) => {
            if (!open) actions.closePriorityDialog()
          }}
          onSubmit={actions.submitPriority}
          isPending={state.isPriorityPending || state.isBulkPriorityPending}
        />
      ) : null}
      {terminateTarget ? (
        <MerchantTerminateDialog
          target={terminateTarget}
          open={state.terminateTarget !== null}
          onOpenChange={(open) => {
            if (!open) actions.closeTerminateDialog()
          }}
          onConfirm={actions.confirmTerminate}
          isPending={state.isTerminatePending}
        />
      ) : null}
      {deleteTarget ? (
        <MerchantDeleteDialog
          merchant={deleteTarget}
          open={state.deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) actions.closeDeleteDialog()
          }}
          onConfirm={actions.confirmDelete}
          isPending={state.isDeletePending}
        />
      ) : null}
    </>
  )
}

/**
 * Usage:
 * ```tsx
 * <MerchantsTable.Provider>
 *   <MerchantsTable.Toolbar />
 *   <MerchantsTable.BulkActions />
 *   <MerchantsTable.Grid />
 *   <MerchantsTable.Dialogs />
 * </MerchantsTable.Provider>
 * ```
 */
const MerchantsTable = {
  Provider: MerchantsTableProvider,
  Toolbar,
  BulkActions,
  Grid,
  Dialogs,
}

// ─── Default Composed Layout ────────────────────────────────────────────────

export function MerchantsTableComposed() {
  return (
    <MerchantsTable.Provider>
      <TooltipProvider>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="shrink-0">
            <MerchantsTable.Toolbar />
          </div>
          <div className="shrink-0">
            <MerchantsTable.BulkActions />
          </div>
          <div className="min-h-0 flex-1">
            <MerchantsTable.Grid />
          </div>
          <MerchantsTable.Dialogs />
        </div>
      </TooltipProvider>
    </MerchantsTable.Provider>
  )
}
