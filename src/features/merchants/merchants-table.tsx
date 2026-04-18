import { AlertTriangleIcon, Trash2Icon } from 'lucide-react'

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
} from '#/components/data-table'
import type { Priority } from '#/schemas/merchants.schema'
import {
  ONBOARDING_STAGES,
  ONBOARDING_STAGE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  BUSINESS_SCOPES,
  BUSINESS_SCOPE_LABELS,
} from '#/schemas/merchants.schema'
import {
  MerchantsTableProvider,
  useMerchantsTable,
} from './merchants-table-context'
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

// ─── Toolbar ────────────────────────────────────────────────────────────────

function Toolbar() {
  const { state, actions, meta } = useMerchantsTable()
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
          title="Stage"
          options={stageFilterOptions}
          selectedValues={meta.commaToSet(filters.onboardingStage)}
          onChange={(set) =>
            actions.setFilter('onboardingStage', meta.setToCommaString(set))
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
        {selectedIds.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} of {flatData.length} row(s) selected
          </span>
        )}
        {!state.isLoading && (
          <span className="text-sm text-muted-foreground">
            Total {state.totalCount} Merchants
          </span>
        )}
      </DataTableToolbar.Actions>
    </DataTableToolbar>
  )
}

// ─── Bulk Actions ───────────────────────────────────────────────────────────

function BulkActions() {
  const { state, actions } = useMerchantsTable()
  const canEditPriority =
    state.userRole === 'admin' || state.userRole === 'supervisor'
  const canDelete = state.userRole === 'admin'

  return (
    <DataTableSelectionInfo
      selectedCount={state.selectedIds.length}
      visibleCount={state.flatData.length}
    >
      {canEditPriority && (
        <div className="flex items-center gap-2">
          <Select
            value={state.bulkPriorityValue}
            onValueChange={(v) =>
              actions.setBulkPriorityValue(v as Priority)
            }
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
            onClick={actions.submitBulkPriority}
            disabled={state.isBulkPriorityPending}
          >
            <AlertTriangleIcon data-icon="inline-start" />
            Set Priority
          </Button>
        </div>
      )}
      {canDelete && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() =>
            actions.openDeleteDialog({
              type: 'bulk',
              ids: state.selectedIds,
            })
          }
          disabled={state.isDeletePending}
        >
          <Trash2Icon data-icon="inline-start" />
          Delete ({state.selectedIds.length})
        </Button>
      )}
    </DataTableSelectionInfo>
  )
}

// ─── Data Grid ──────────────────────────────────────────────────────────────

function Grid() {
  const { state, actions, meta } = useMerchantsTable()

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
    />
  )
}

// ─── Dialogs ────────────────────────────────────────────────────────────────

function Dialogs() {
  const { state, actions } = useMerchantsTable()
  const { priorityDialogMerchant, deleteTarget } = state

  return (
    <>
      <MerchantPriorityDialog
        merchant={priorityDialogMerchant}
        open={priorityDialogMerchant !== null}
        onOpenChange={(open) => {
          if (!open) actions.closePriorityDialog()
        }}
        onSubmit={actions.submitPriority}
        isPending={state.isPriorityPending}
      />
      <MerchantDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) actions.closeDeleteDialog()
        }}
        onConfirm={actions.confirmDelete}
        isPending={state.isDeletePending}
        description={
          deleteTarget?.type === 'single'
            ? `Are you sure you want to delete "${deleteTarget.merchant.businessName}"? This action cannot be undone.`
            : `Are you sure you want to delete ${deleteTarget?.ids?.length ?? 0} merchant(s)? This action cannot be undone.`
        }
      />
    </>
  )
}

// ─── Compound Component ─────────────────────────────────────────────────────

/**
 * MerchantsTable compound component.
 *
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
export const MerchantsTable = {
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
