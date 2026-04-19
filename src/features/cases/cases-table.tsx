import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { UserIcon } from 'lucide-react'

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
import { CASE_STATUSES, CASE_STATUS_LABELS } from '#/schemas/cases.schema'
import { CaseAssignOwnerDialog } from './case-assign-owner-dialog'
import { CasePriorityDialog } from './case-priority-dialog'
import {
  CasesTableProvider,
  useCasesTableActions,
  useCasesTableMeta,
  useCasesTableState,
} from './cases-table-context'

// ─── Filter Option Configs ──────────────────────────────────────────────────

const statusFilterOptions = CASE_STATUSES.map((s) => ({
  label: CASE_STATUS_LABELS[s],
  value: s,
}))

// ─── Queue Selector (top-right) ─────────────────────────────────────────────

function QueueSelector() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const { filters } = state
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('page-header-actions'))
  }, [])

  const content = (
    <Select
      value={filters.queueId ?? 'all'}
      onValueChange={(v) =>
        actions.setFilter('queueId', v === 'all' ? undefined : v)
      }
    >
      <SelectTrigger className="w-50">
        <SelectValue placeholder="All Queues" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">All Queues</SelectItem>
          {state.queues.map((queue) => (
            <SelectItem key={queue.id} value={queue.id}>
              {queue.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )

  if (!portalTarget) return null
  return createPortal(content, portalTarget)
}

// ─── Toolbar ────────────────────────────────────────────────────────────────

function Toolbar() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const meta = useCasesTableMeta()
  const { filters, selectedIds, flatData } = state

  const ownerFilterOptions = state.users.map((user) => ({
    label: user.name,
    value: user.id,
  }))

  return (
    <DataTableToolbar>
      <DataTableToolbar.Filters>
        <DataTableSearch
          value={filters.search ?? ''}
          onChange={(v) => actions.setFilter('search', v || undefined)}
          placeholder="Search by case number or merchant name..."
        />
        <DataTableFilter
          title="Status"
          options={statusFilterOptions}
          selectedValues={meta.commaToSet(filters.status)}
          onChange={(set) =>
            actions.setFilter('status', meta.setToCommaString(set))
          }
        />
        <DataTableFilter
          title="Case Owner"
          options={ownerFilterOptions}
          selectedValues={meta.commaToSet(filters.ownerId)}
          onChange={(set) =>
            actions.setFilter('ownerId', meta.setToCommaString(set))
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
            Total {state.totalCount} Cases
          </span>
        )}
      </DataTableToolbar.Actions>
    </DataTableToolbar>
  )
}

// ─── Bulk Actions ───────────────────────────────────────────────────────────

function BulkActions() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const canAssign =
    state.userRole === 'admin' || state.userRole === 'supervisor'

  return (
    <DataTableSelectionInfo
      selectedCount={state.selectedIds.length}
      visibleCount={state.flatData.length}
    >
      {canAssign && (
        <div className="flex items-center gap-2">
          <Select
            value={state.bulkAssignOwnerId ?? 'unassigned'}
            onValueChange={(v) =>
              actions.setBulkAssignOwnerId(v === 'unassigned' ? null : v)
            }
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {state.users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={actions.submitBulkAssign}
            disabled={
              state.isBulkAssignPending || state.selectedIds.length === 0
            }
          >
            <UserIcon data-icon="inline-start" />
            Assign Owner
          </Button>
        </div>
      )}
    </DataTableSelectionInfo>
  )
}

// ─── Data Grid ──────────────────────────────────────────────────────────────

function Grid() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const meta = useCasesTableMeta()

  return (
    <DataTable
      columns={meta.columns}
      data={state.flatData}
      getRowId={(c) => c.id}
      selectedIds={meta.selectedIdSet}
      isLoading={state.isLoading}
      onScrollEnd={actions.fetchNextPage}
      isFetchingMore={state.isFetchingNextPage}
      hasMore={state.hasNextPage}
    />
  )
}

function Dialogs() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()

  return (
    <>
      {state.assignOwnerCase && (
        <CaseAssignOwnerDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              actions.closeAssignOwnerDialog()
            }
          }}
          caseId={state.assignOwnerCase.id}
          caseNumber={state.assignOwnerCase.caseNumber}
          currentOwnerId={state.assignOwnerCase.ownerId}
          currentOwnerName={state.assignOwnerCase.ownerName}
        />
      )}
      {state.priorityCase && (
        <CasePriorityDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              actions.closePriorityDialog()
            }
          }}
          caseItem={state.priorityCase}
        />
      )}
    </>
  )
}

// ─── Compound Component ─────────────────────────────────────────────────────

export const CasesTable = {
  Provider: CasesTableProvider,
  QueueSelector,
  Toolbar,
  BulkActions,
  Grid,
  Dialogs,
}

// ─── Default Composed Layout ────────────────────────────────────────────────

export function CasesTableComposed() {
  return (
    <CasesTable.Provider>
      <CasesTable.QueueSelector />
      <TooltipProvider>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="shrink-0">
            <CasesTable.Toolbar />
          </div>
          <div className="shrink-0">
            <CasesTable.BulkActions />
          </div>
          <div className="min-h-0 flex-1">
            <CasesTable.Grid />
          </div>
          <CasesTable.Dialogs />
        </div>
      </TooltipProvider>
    </CasesTable.Provider>
  )
}
