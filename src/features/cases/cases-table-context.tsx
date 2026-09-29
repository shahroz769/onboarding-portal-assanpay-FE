import { createContext, use, useState } from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { useAuth } from '#/features/auth/auth-client'
import {
  CASES_KEY,
  casesInfiniteQueryOptions,
  queuesQueryOptions,
  useBulkAssignCasesMutation,
} from '#/hooks/use-cases-query'
import { userDirectoryQueryOptions } from '#/hooks/use-users-query'
import { useMorph } from '#/hooks/use-morph'
import type { MorphPopupProps } from '#/hooks/use-morph'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import type {
  CaseListItem,
  CaseRouteSearch,
  CaseSortableColumn,
  Queue,
} from '#/schemas/cases.schema'
import type { UserDirectoryItem } from '#/schemas/users.schema'
import type { RoleType } from '#/types/auth'
import { createCaseColumns } from './cases-columns'

interface CasesTableState {
  flatData: CaseListItem[]
  selectedIds: string[]
  filters: CaseRouteSearch
  hideOwnerFilter: boolean
  hideStatusFilter: boolean
  userRole: RoleType
  isLoading: boolean
  error: Error | null
  totalCount: number | null
  hasNextPage: boolean
  isFetchingNextPage: boolean
  queues: Queue[]
  isQueuesLoading: boolean
  users: UserDirectoryItem[]
  isUsersLoading: boolean
  bulkAssignOwnerId: string | null
  isBulkAssignPending: boolean
  bulkAssignError: string | null
  assignOwnerCase: CaseListItem | null
  priorityCase: CaseListItem | null
  assignOwnerPopupProps: MorphPopupProps
  priorityPopupProps: MorphPopupProps
}

interface CasesTableActions {
  setFilter: (key: keyof CaseRouteSearch, value: string | undefined) => void
  clearFilters: () => void
  fetchNextPage: () => void
  retry: () => void
  setBulkAssignOwnerId: (value: string | null) => void
  submitBulkAssign: () => void
  openAssignOwnerDialog: (item: CaseListItem, trigger?: HTMLElement) => void
  closeAssignOwnerDialog: () => void
  openPriorityDialog: (item: CaseListItem, trigger?: HTMLElement) => void
  closePriorityDialog: () => void
}

interface CasesTableMeta {
  columns: DataTableColumnDef<CaseListItem>[]
  selectedIdSet: Set<string>
  commaToSet: (value: string | undefined) => Set<string>
  setToCommaString: (set: Set<string>) => string | undefined
}

type CasesTableProviderProps = {
  children: React.ReactNode
  filters: CaseRouteSearch
  setFilter: (key: keyof CaseRouteSearch, value: string | undefined) => void
  setFilters: (partialFilters: Partial<CaseRouteSearch>) => void
  hideOwnerFilter?: boolean
  hideStatusFilter?: boolean
  queueAccess?: 'view' | 'work'
}

const CasesTableStateContext = createContext<CasesTableState | null>(null)
const CasesTableActionsContext = createContext<CasesTableActions | null>(null)
const CasesTableMetaContext = createContext<CasesTableMeta | null>(null)

function useRequiredContext<T>(context: React.Context<T | null>) {
  const value = use(context)

  if (!value) {
    throw new Error('useCasesTable must be used within CasesTable.Provider')
  }

  return value
}

export function useCasesTableState() {
  return useRequiredContext(CasesTableStateContext)
}

export function useCasesTableActions() {
  return useRequiredContext(CasesTableActionsContext)
}

export function useCasesTableMeta() {
  return useRequiredContext(CasesTableMetaContext)
}

function CasesTableProviderState({
  children,
  filters,
  setFilter,
  setFilters,
  hideOwnerFilter = false,
  hideStatusFilter = false,
  queueAccess = 'view',
}: CasesTableProviderProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userRole = user?.roleType ?? 'agent'

  const handleSort = (columnId: CaseSortableColumn) => {
    const isSameColumn = filters.sortBy === columnId
    const nextOrder =
      isSameColumn && filters.sortOrder === 'asc' ? 'desc' : 'asc'

    if (!isSameColumn) {
      queryClient.removeQueries({ queryKey: CASES_KEY })
    }

    setFilters({ sortBy: columnId, sortOrder: nextOrder })
  }

  const [selectedIdCandidates, setSelectedIdSet] = useState<Set<string>>(
    new Set(),
  )
  const [bulkAssignOwnerId, setBulkAssignOwnerId] = useState<string | null>(
    null,
  )
  const [bulkAssignError, setBulkAssignError] = useState<string | null>(null)

  // A new result set drops the row selection and bulk-assign draft. Reset in
  // place (React's "adjust state on prop change") rather than re-keying the
  // provider: a remount closed open filter popovers and dialogs and blurred
  // the search box on every filter change.
  const filtersKey = JSON.stringify({
    search: filters.search,
    queueId: filters.queueId,
    ownerId: filters.ownerId,
    status: filters.status,
    priority: filters.priority,
    merchantId: filters.merchantId,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  })
  const [selectionFiltersKey, setSelectionFiltersKey] = useState(filtersKey)
  if (selectionFiltersKey !== filtersKey) {
    setSelectionFiltersKey(filtersKey)
    setSelectedIdSet(new Set())
    setBulkAssignOwnerId(null)
    setBulkAssignError(null)
  }

  const [assignOwnerCase, setAssignOwnerCase] = useState<CaseListItem | null>(
    null,
  )
  const [priorityCase, setPriorityCase] = useState<CaseListItem | null>(null)
  // Row dialogs grow out of the Owner / Priority cell that opened them.
  const assignOwnerMorph = useMorph()
  const priorityMorph = useMorph()
  const openAssignOwner = (item: CaseListItem, trigger?: HTMLElement) =>
    assignOwnerMorph.run(() => setAssignOwnerCase(item), trigger)
  const openPriority = (item: CaseListItem, trigger?: HTMLElement) =>
    priorityMorph.run(() => setPriorityCase(item), trigger)

  const {
    data,
    isLoading,
    isFetching,
    isPlaceholderData,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    casesInfiniteQueryOptions({
      ...filters,
      queueAccess,
      createdAtFrom: undefined,
      createdAtTo: undefined,
    }),
  )

  // Skeleton only while there is nothing to show for these filters: a
  // background refetch of cached rows keeps them visible and swaps quietly.
  const isTableLoading = isLoading || (isFetching && isPlaceholderData)

  const { data: availableQueues = [], isLoading: isQueuesLoading } =
    useQuery(queuesQueryOptions())

  const workQueueIds = new Set(user?.workQueueIds ?? [])
  const queues =
    queueAccess === 'work' && user?.roleType === 'agent'
      ? availableQueues.filter((queue) => workQueueIds.has(queue.id))
      : availableQueues

  const { data: caseUsers = [], isLoading: isUsersLoading } = useQuery(
    userDirectoryQueryOptions(),
  )

  const bulkAssign = useBulkAssignCasesMutation()

  const flatData = data?.pages.flatMap((page) => page.cases) ?? []

  const totalCount = data?.pages[0]?.total ?? null
  const assignableIds =
    userRole === 'super_admin' || userRole === 'admin'
      ? flatData.flatMap((item) =>
          item.status !== 'closed' && !item.closeOutcome && !item.closedAt
            ? [item.id]
            : [],
        )
      : []

  const assignableIdSet = new Set(assignableIds)
  const selectedIdSet = new Set(
    Array.from(selectedIdCandidates).filter((id) => assignableIdSet.has(id)),
  )

  const handleSelectRow = (id: string, selected: boolean) => {
    const next = new Set(selectedIdCandidates)

    if (selected) {
      next.add(id)
    } else {
      next.delete(id)
    }

    setSelectedIdSet(next)
    if (next.size === 0) {
      setBulkAssignOwnerId(null)
    }
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedIdSet(selected ? new Set(assignableIds) : new Set())
    if (!selected) {
      setBulkAssignOwnerId(null)
    }
  }

  const selectedIds = Array.from(selectedIdSet)

  const columns = createCaseColumns({
    userRole,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    onSort: handleSort,
    selectedIds: selectedIdSet,
    allIds: assignableIds,
    onSelectRow: handleSelectRow,
    onSelectAll: handleSelectAll,
    onOpenAssignOwner: openAssignOwner,
    onOpenPriority: openPriority,
  })

  const commaToSet = (value: string | undefined) =>
    new Set(value?.split(',').filter(Boolean) ?? [])

  const setToCommaString = (set: Set<string>) =>
    set.size > 0 ? Array.from(set).join(',') : undefined

  const submitBulkAssign = () => {
    if (selectedIds.length === 0) {
      return
    }

    bulkAssign.mutate(
      { ids: selectedIds, ownerId: bulkAssignOwnerId },
      {
        onSuccess: () => {
          setSelectedIdSet(new Set())
          setBulkAssignOwnerId(null)
          setBulkAssignError(null)
        },
        onError: (error) =>
          setBulkAssignError(
            getApiErrorMessage(error, 'Unable to assign the selected cases.'),
          ),
      },
    )
  }

  const handleFetchNextPage = () => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }

  const stateValue: CasesTableState = {
    flatData,
    selectedIds,
    filters,
    hideOwnerFilter,
    hideStatusFilter,
    userRole,
    isLoading: isTableLoading,
    error,
    totalCount,
    hasNextPage,
    isFetchingNextPage,
    queues,
    isQueuesLoading,
    users: caseUsers,
    isUsersLoading,
    bulkAssignOwnerId,
    isBulkAssignPending: bulkAssign.isPending,
    bulkAssignError,
    assignOwnerCase,
    priorityCase,
    assignOwnerPopupProps: assignOwnerMorph.popupProps,
    priorityPopupProps: priorityMorph.popupProps,
  }

  const actionsValue: CasesTableActions = {
    setFilter,
    // Only the toolbar's filters: the queue belongs to the page header, and
    // hidden filters are fixed by the route.
    clearFilters: () =>
      setFilters({
        search: undefined,
        merchantId: undefined,
        priority: undefined,
        ...(hideOwnerFilter ? {} : { ownerId: undefined }),
        ...(hideStatusFilter ? {} : { status: undefined }),
      }),
    fetchNextPage: handleFetchNextPage,
    retry: () => void refetch(),
    setBulkAssignOwnerId: (value) => {
      setBulkAssignOwnerId(value)
      setBulkAssignError(null)
    },
    submitBulkAssign,
    openAssignOwnerDialog: openAssignOwner,
    closeAssignOwnerDialog: () => setAssignOwnerCase(null),
    openPriorityDialog: openPriority,
    closePriorityDialog: () => setPriorityCase(null),
  }

  const metaValue: CasesTableMeta = {
    columns,
    selectedIdSet,
    commaToSet,
    setToCommaString,
  }

  return (
    <CasesTableStateContext value={stateValue}>
      <CasesTableActionsContext value={actionsValue}>
        <CasesTableMetaContext value={metaValue}>
          {children}
        </CasesTableMetaContext>
      </CasesTableActionsContext>
    </CasesTableStateContext>
  )
}

export { CasesTableProviderState as CasesTableProvider }
