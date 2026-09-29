import { useState } from 'react'
import { AlertTriangleIcon, BanIcon, Play, Store } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { EmptyState, FilteredEmptyState } from '#/components/empty-state'
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
import { useMorph } from '#/hooks/use-morph'
import { MerchantTerminateDialog } from './merchants-terminate-dialog'
import { MerchantDeleteDialog } from './merchant-delete-dialog'
import {
  TriggerCaseButton,
  TriggerCaseDialog,
  useCanTriggerCases,
} from '#/features/cases/trigger-case-dialog'

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
  const { filters } = state

  return (
    <DataTableToolbar>
      <DataTableToolbar.Filters>
        <DataTableSearch
          value={filters.search ?? ''}
          onChange={(v) => actions.setFilter('search', v || undefined)}
          label="Search merchants"
          placeholder="Search by ID or name…"
        />
        {/* Filters follow the table's column order; Scope has no column. */}
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
      </DataTableToolbar.Filters>
      <DataTableToolbar.Actions>
        <TriggerCaseButton />
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
  const canTriggerCases = useCanTriggerCases()
  const [triggerOpen, setTriggerOpen] = useState(false)
  const triggerMorph = useMorph()
  const actionableIdSet = new Set(actionableIds)
  const triggerMerchants = state.flatData.filter((merchant) =>
    actionableIdSet.has(merchant.id),
  )

  return (
    <DataTableSelectionInfo
      selectedCount={state.selectedIds.length}
      visibleCount={state.flatData.length}
    >
      {canTriggerCases && actionableIds.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={(event) =>
            triggerMorph.run(() => setTriggerOpen(true), event.currentTarget)
          }
        >
          <Play data-icon="inline-start" />
          Trigger Case ({actionableIds.length})
        </Button>
      )}
      {canEditPriority && actionableIds.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) =>
            actions.openBulkPriorityDialog(event.currentTarget)
          }
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
          onClick={(event) =>
            actions.openTerminateDialog(
              { type: 'bulk', ids: actionableIds },
              event.currentTarget,
            )
          }
          disabled={state.isTerminatePending}
        >
          <BanIcon data-icon="inline-start" />
          Terminate ({actionableIds.length})
        </Button>
      )}
      <TriggerCaseDialog
        open={triggerOpen}
        onOpenChange={setTriggerOpen}
        merchants={triggerMerchants}
        onTriggered={actions.clearSelection}
        popupProps={triggerMorph.popupProps}
      />
    </DataTableSelectionInfo>
  )
}

// ─── Data Grid ──────────────────────────────────────────────────────────────

function Grid() {
  const state = useMerchantsTableState()
  const actions = useMerchantsTableActions()
  const meta = useMerchantsTableMeta()
  const { search, status, priority, businessScope, currency } = state.filters
  // No status in the URL means the default (everything but terminated).
  const hasOtherFilters = !!(
    (status && status !== DEFAULT_MERCHANT_STATUS_FILTER) ||
    priority ||
    businessScope ||
    currency
  )

  return (
    <DataTable
      columns={meta.columns}
      data={state.flatData}
      getRowId={(m) => m.id}
      selectedIds={meta.selectedIdSet}
      isLoading={state.isLoading}
      error={state.error}
      onRetry={actions.retry}
      onScrollEnd={actions.fetchNextPage}
      isFetchingMore={state.isFetchingNextPage}
      hasMore={state.hasNextPage}
      totalCount={state.totalCount}
      emptyContent={
        search || hasOtherFilters ? (
          <FilteredEmptyState
            noun="merchants"
            search={search}
            hasOtherFilters={hasOtherFilters}
            onClearFilters={actions.clearFilters}
          />
        ) : (
          <EmptyState
            icon={Store}
            title="No merchants yet."
            description="Merchants appear here once they submit the onboarding form."
          />
        )
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
      <MerchantPriorityDialog
        target={priorityTarget}
        open={state.priorityTarget !== null}
        onOpenChange={(open) => {
          if (!open) actions.closePriorityDialog()
        }}
        onSubmit={actions.submitPriority}
        isPending={state.isPriorityPending || state.isBulkPriorityPending}
        popupProps={state.priorityPopupProps}
      />
      <MerchantTerminateDialog
        target={terminateTarget}
        open={state.terminateTarget !== null}
        onOpenChange={(open) => {
          if (!open) actions.closeTerminateDialog()
        }}
        onConfirm={actions.confirmTerminate}
        isPending={state.isTerminatePending}
        popupProps={state.terminatePopupProps}
      />
      <MerchantDeleteDialog
        merchant={deleteTarget}
        open={state.deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) actions.closeDeleteDialog()
        }}
        onConfirm={actions.confirmDelete}
        isPending={state.isDeletePending}
        popupProps={state.deletePopupProps}
      />
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
