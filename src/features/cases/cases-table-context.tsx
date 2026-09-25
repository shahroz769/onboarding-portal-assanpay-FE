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
}

interface CasesTableActions {
  setFilter: (key: keyof CaseRouteSearch, value: string | undefined) => void
  fetchNextPage: () => void
  setBulkAssignOwnerId: (value: string | null) => void
  submitBulkAssign: () => void
  openAssignOwnerDialog: (item: CaseListItem) => void
  closeAssignOwnerDialog: () => void
  openPriorityDialog: (item: CaseListItem) => void
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
  const [assignOwnerCase, setAssignOwnerCase] = useState<CaseListItem | null>(
    null,
  )
  const [priorityCase, setPriorityCase] = useState<CaseListItem | null>(null)

  const {
    data,
    isLoading,
    isFetching,
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

  const isTableLoading = isLoading || (isFetching && !isFetchingNextPage)

  const { data: availableQueues = [], isLoading: isQueuesLoading } =
    useQuery(queuesQueryOptions())

  const workQueueIds = new Set(user?.workQueueIds ?? [])
  const queues =
    queueAccess === 'work'
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
          item.status !== 'closed' &&
          item.status !== 'error' &&
          !item.closeOutcome &&
          !item.closedAt
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
    onOpenAssignOwner: setAssignOwnerCase,
    onOpenPriority: setPriorityCase,
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
  }

  const actionsValue: CasesTableActions = {
    setFilter,
    fetchNextPage: handleFetchNextPage,
    setBulkAssignOwnerId: (value) => {
      setBulkAssignOwnerId(value)
      setBulkAssignError(null)
    },
    submitBulkAssign,
    openAssignOwnerDialog: setAssignOwnerCase,
    closeAssignOwnerDialog: () => setAssignOwnerCase(null),
    openPriorityDialog: setPriorityCase,
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

function CasesTableProvider(props: CasesTableProviderProps) {
  const resetKey = JSON.stringify({
    search: props.filters.search,
    queueId: props.filters.queueId,
    ownerId: props.filters.ownerId,
    status: props.filters.status,
    sortBy: props.filters.sortBy,
    sortOrder: props.filters.sortOrder,
  })

  return <CasesTableProviderState key={resetKey} {...props} />
}

export { CasesTableProvider }
