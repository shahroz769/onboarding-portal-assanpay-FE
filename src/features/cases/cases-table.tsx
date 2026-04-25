import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { UserIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
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
import type { CaseRouteSearch } from '#/schemas/cases.schema'
import { CASE_STATUSES, CASE_STATUS_LABELS } from '#/schemas/cases.schema'
import { CaseAssignOwnerDialog } from './case-assign-owner-dialog'
import { CasePriorityDialog } from './case-priority-dialog'
import {
  CasesTableProvider,
  useCasesTableActions,
  useCasesTableMeta,
  useCasesTableState,
} from './cases-table-context'

const statusFilterOptions = CASE_STATUSES.map((status) => ({
  label: CASE_STATUS_LABELS[status],
  value: status,
}))

function QueueSelector() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const { filters } = state
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('page-header-actions'))
  }, [])

  const content = state.isQueuesLoading ? (
    <Skeleton className="h-9 w-50" />
  ) : (
    <Select
      value={filters.queueId ?? 'all'}
      onValueChange={(value) =>
        actions.setFilter('queueId', value === 'all' ? undefined : value)
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
          onChange={(value) => actions.setFilter('search', value || undefined)}
          placeholder="Search by case number or merchant name..."
        />
        {state.hideStatusFilter ? null : (
          <DataTableFilter
            title="Status"
            options={statusFilterOptions}
            selectedValues={meta.commaToSet(filters.status)}
            onChange={(set) =>
              actions.setFilter('status', meta.setToCommaString(set))
            }
          />
        )}
        {state.hideOwnerFilter ? null : state.isUsersLoading ? (
          <Skeleton className="h-9 w-32" />
        ) : (
          <DataTableFilter
            title="Case Owner"
            options={ownerFilterOptions}
            selectedValues={meta.commaToSet(filters.ownerId)}
            onChange={(set) =>
              actions.setFilter('ownerId', meta.setToCommaString(set))
            }
          />
        )}
      </DataTableToolbar.Filters>
      <DataTableToolbar.Actions>
        {selectedIds.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} of {flatData.length} row(s) selected
          </span>
        ) : null}
        {state.isLoading ? null : (
          <span className="text-sm text-muted-foreground">
            Loaded {state.loadedCount} Cases
          </span>
        )}
      </DataTableToolbar.Actions>
    </DataTableToolbar>
  )
}

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
      {canAssign ? (
        <div className="flex items-center gap-2">
          {state.isUsersLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <Select
              value={state.bulkAssignOwnerId ?? 'unassigned'}
              onValueChange={(value) =>
                actions.setBulkAssignOwnerId(
                  value === 'unassigned' ? null : value,
                )
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
          )}
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
      ) : null}
    </DataTableSelectionInfo>
  )
}

function Grid() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const meta = useCasesTableMeta()

  return (
    <DataTable
      columns={meta.columns}
      data={state.flatData}
      getRowId={(caseItem) => caseItem.id}
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
      {state.assignOwnerCase ? (
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
      ) : null}
      {state.priorityCase ? (
        <CasePriorityDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              actions.closePriorityDialog()
            }
          }}
          caseItem={state.priorityCase}
        />
      ) : null}
    </>
  )
}

export const CasesTable = {
  Provider: CasesTableProvider,
  QueueSelector,
  Toolbar,
  BulkActions,
  Grid,
  Dialogs,
}

interface CasesTableComposedProps {
  filters: CaseRouteSearch
  setFilter: (key: keyof CaseRouteSearch, value: string | undefined) => void
  setFilters: (partialFilters: Partial<CaseRouteSearch>) => void
  hideOwnerFilter?: boolean
  hideStatusFilter?: boolean
}

export function CasesTableComposed({
  filters,
  setFilter,
  setFilters,
  hideOwnerFilter = false,
  hideStatusFilter = false,
}: CasesTableComposedProps) {
  return (
    <CasesTable.Provider
      filters={filters}
      setFilter={setFilter}
      setFilters={setFilters}
      hideOwnerFilter={hideOwnerFilter}
      hideStatusFilter={hideStatusFilter}
    >
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
