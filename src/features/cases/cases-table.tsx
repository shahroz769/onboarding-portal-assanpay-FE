import { useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircleIcon, FolderOpen, UserIcon } from 'lucide-react'

import { EmptyState, FilteredEmptyState } from '#/components/empty-state'
import { Alert, AlertDescription } from '#/components/ui/alert'
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
import type { CaseFilterStatus, CaseRouteSearch } from '#/schemas/cases.schema'
import {
  CASE_FILTER_STATUS_LABELS,
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
} from '#/schemas/cases.schema'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { merchantOptionsQueryOptions } from '#/hooks/use-merchants-query'
import { usePageHeaderActions } from '#/hooks/use-page-header-actions'
import { CaseAssignOwnerDialog } from './case-assign-owner-dialog'
import { useRetainedValue } from '#/hooks/use-retained-value'
import { CasePriorityDialog } from './case-priority-dialog'
import {
  CasesTableProvider,
  useCasesTableActions,
  useCasesTableMeta,
  useCasesTableState,
} from './cases-table-context'

const CASE_STATUS_FILTER_ORDER = [
  'new',
  'working',
  'awaiting_merchant',
  'closed',
  'unsuccessful',
] as const satisfies ReadonlyArray<CaseFilterStatus>

const statusFilterOptions = CASE_STATUS_FILTER_ORDER.map((status) => ({
  label: CASE_FILTER_STATUS_LABELS[status],
  value: status,
}))

const priorityFilterOptions = CASE_PRIORITIES.map((priority) => ({
  label: CASE_PRIORITY_LABELS[priority],
  value: priority,
}))

/**
 * Merchants can number in the thousands, so options come from a debounced
 * server search rather than a preloaded list.
 */
function MerchantFilter() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const meta = useCasesTableMeta()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const { data, isFetching } = useQuery(
    merchantOptionsQueryOptions(debouncedSearch.trim()),
  )
  const options = (data?.merchants ?? []).map((merchant) => ({
    label: merchant.businessName,
    value: merchant.id,
  }))
  // Selected merchants label themselves from the filtered rows, which all
  // belong to them, even when the current search doesn't return them.
  const selectedLabels = new Map(
    state.flatData.map((item) => [item.merchantId, item.merchantName]),
  )

  return (
    <DataTableFilter
      title="Merchant"
      options={options}
      onSearchChange={setSearch}
      isLoading={isFetching || search !== debouncedSearch}
      selectedLabels={selectedLabels}
      selectedValues={meta.commaToSet(state.filters.merchantId)}
      onChange={(set) =>
        actions.setFilter('merchantId', meta.setToCommaString(set))
      }
    />
  )
}

function QueueSelector() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const { filters } = state
  const portalTarget = usePageHeaderActions()

  const content = (
    <Select
      items={[
        { value: 'all', label: 'All Queues' },
        ...state.queues.map((queue) => ({
          value: queue.id,
          label: queue.name,
        })),
      ]}
      value={filters.queueId ?? 'all'}
      onValueChange={(value) =>
        actions.setFilter(
          'queueId',
          value === 'all' ? undefined : (value ?? undefined),
        )
      }
      disabled={state.isQueuesLoading}
    >
      <SelectTrigger className="w-50" aria-label="Queue">
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

function Toolbar({ actions: extraActions }: { actions?: ReactNode }) {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const meta = useCasesTableMeta()
  const { filters } = state

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
          label="Search cases"
          placeholder="Search by case number or merchant name…"
        />
        {/* Filters follow the table's column order (the queue picker lives
            in the page header). */}
        <MerchantFilter />
        {state.hideOwnerFilter ? null : (
          <DataTableFilter
            title="Case Owner"
            searchable
            options={ownerFilterOptions}
            selectedValues={meta.commaToSet(filters.ownerId)}
            onChange={(set) =>
              actions.setFilter('ownerId', meta.setToCommaString(set))
            }
          />
        )}
        {state.hideStatusFilter ? null : (
          <DataTableFilter
            title="Case Status"
            options={statusFilterOptions}
            selectedValues={meta.commaToSet(filters.status)}
            onChange={(set) =>
              actions.setFilter('status', meta.setToCommaString(set))
            }
          />
        )}
        <DataTableFilter
          title="Priority"
          options={priorityFilterOptions}
          selectedValues={meta.commaToSet(filters.priority)}
          onChange={(set) =>
            actions.setFilter('priority', meta.setToCommaString(set))
          }
        />
      </DataTableToolbar.Filters>
      <DataTableToolbar.Actions>
        {extraActions}
      </DataTableToolbar.Actions>
    </DataTableToolbar>
  )
}

function BulkActions() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const canAssign =
    state.userRole === 'super_admin' || state.userRole === 'admin'

  return (
    <DataTableSelectionInfo
      selectedCount={state.selectedIds.length}
      visibleCount={state.flatData.length}
    >
      {canAssign ? (
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {state.isUsersLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <Select
                items={[
                  { value: 'ap-system', label: 'AP System (New)' },
                  ...state.users.map((user) => ({
                    value: user.id,
                    label: user.name,
                  })),
                ]}
                value={state.bulkAssignOwnerId ?? 'ap-system'}
                onValueChange={(value) =>
                  actions.setBulkAssignOwnerId(
                    value === 'ap-system' ? null : value,
                  )
                }
              >
                <SelectTrigger size="sm" aria-label="New owner">
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="ap-system">AP System (New)</SelectItem>
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
          {state.bulkAssignError ? (
            <Alert variant="destructive" className="max-w-xl">
              <AlertCircleIcon />
              <AlertDescription>{state.bulkAssignError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </DataTableSelectionInfo>
  )
}

function Grid() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const meta = useCasesTableMeta()
  const { search, merchantId, priority, ownerId, status } = state.filters
  const hasOtherFilters = !!(
    merchantId ||
    priority ||
    (!state.hideOwnerFilter && ownerId) ||
    (!state.hideStatusFilter && status)
  )

  return (
    <DataTable
      columns={meta.columns}
      data={state.flatData}
      getRowId={(caseItem) => caseItem.id}
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
            noun="cases"
            search={search}
            hasOtherFilters={hasOtherFilters}
            onClearFilters={actions.clearFilters}
          />
        ) : (
          <EmptyState icon={FolderOpen} title="No cases here yet." />
        )
      }
    />
  )
}

function Dialogs() {
  const state = useCasesTableState()
  const actions = useCasesTableActions()
  const assignOwnerCase = useRetainedValue(state.assignOwnerCase)
  const priorityCase = useRetainedValue(state.priorityCase)

  return (
    <>
      <CaseAssignOwnerDialog
        open={state.assignOwnerCase !== null}
        onOpenChange={(open) => {
          if (!open) {
            actions.closeAssignOwnerDialog()
          }
        }}
        target={
          assignOwnerCase
            ? {
                caseId: assignOwnerCase.id,
                caseNumber: assignOwnerCase.caseNumber,
                currentOwnerId: assignOwnerCase.ownerId,
                isClosed:
                  assignOwnerCase.status === 'closed' ||
                  !!assignOwnerCase.closedAt,
              }
            : null
        }
        popupProps={state.assignOwnerPopupProps}
      />
      <CasePriorityDialog
        popupProps={state.priorityPopupProps}
        open={state.priorityCase !== null}
        onOpenChange={(open) => {
          if (!open) {
            actions.closePriorityDialog()
          }
        }}
        caseItem={priorityCase}
      />
    </>
  )
}

const CasesTable = {
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
  queueAccess?: 'view' | 'work'
  /** Rendered at the right end of the toolbar, opposite the filters. */
  toolbarActions?: ReactNode
}

export function CasesTableComposed({
  filters,
  setFilter,
  setFilters,
  hideOwnerFilter = false,
  hideStatusFilter = false,
  queueAccess = 'view',
  toolbarActions,
}: CasesTableComposedProps) {
  return (
    <CasesTable.Provider
      filters={filters}
      setFilter={setFilter}
      setFilters={setFilters}
      hideOwnerFilter={hideOwnerFilter}
      hideStatusFilter={hideStatusFilter}
      queueAccess={queueAccess}
    >
      <CasesTable.QueueSelector />
      <TooltipProvider>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="shrink-0">
            <CasesTable.Toolbar actions={toolbarActions} />
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
