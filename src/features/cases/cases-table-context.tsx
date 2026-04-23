import {
  createContext,
  useEffect,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
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
  usersQueryOptions,
} from '#/hooks/use-cases-query'
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import type {
  CaseListItem,
  CaseRouteSearch,
  CaseSortableColumn,
  Queue,
} from '#/schemas/cases.schema'
import type { RoleType, User } from '#/types/auth'
import { createCaseColumns } from './cases-columns'

interface CasesTableState {
  flatData: CaseListItem[]
  selectedIds: string[]
  filters: CaseRouteSearch
  hideOwnerFilter: boolean
  hideStatusFilter: boolean
  userRole: RoleType
  isLoading: boolean
  totalCount: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  queues: Queue[]
  isQueuesLoading: boolean
  users: User[]
  isUsersLoading: boolean
  bulkAssignOwnerId: string | null
  isBulkAssignPending: boolean
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

function CasesTableProvider({
  children,
  filters,
  setFilter,
  setFilters,
  hideOwnerFilter = false,
  hideStatusFilter = false,
}: CasesTableProviderProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userRole = user?.roleType ?? 'employee'

  const handleSort = useCallback(
    (columnId: CaseSortableColumn) => {
      const isSameColumn = filters.sortBy === columnId
      const nextOrder =
        isSameColumn && filters.sortOrder === 'asc' ? 'desc' : 'asc'

      if (!isSameColumn) {
        queryClient.removeQueries({ queryKey: CASES_KEY })
      }

      setFilters({ sortBy: columnId, sortOrder: nextOrder })
    },
    [filters.sortBy, filters.sortOrder, queryClient, setFilters],
  )

  const [selectedIdSet, setSelectedIdSet] = useState<Set<string>>(new Set())
  const [bulkAssignOwnerId, setBulkAssignOwnerId] = useState<string | null>(
    null,
  )
  const [assignOwnerCase, setAssignOwnerCase] = useState<CaseListItem | null>(
    null,
  )
  const [priorityCase, setPriorityCase] = useState<CaseListItem | null>(null)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(
      casesInfiniteQueryOptions({
        ...filters,
        createdAtFrom: undefined,
        createdAtTo: undefined,
      }),
    )

  const { data: queues = [], isLoading: isQueuesLoading } =
    useQuery(queuesQueryOptions())

  const { data: caseUsers = [], isLoading: isUsersLoading } =
    useQuery(usersQueryOptions())

  const bulkAssign = useBulkAssignCasesMutation()

  const flatData = useMemo(
    () => data?.pages.flatMap((page) => page.cases) ?? [],
    [data],
  )
  const totalCount = data?.pages[0]?.totalCount ?? 0
  const allIds = useMemo(() => flatData.map((c) => c.id), [flatData])
  const filtersKey = useMemo(
    () =>
      JSON.stringify({
        search: filters.search,
        queueId: filters.queueId,
        ownerId: filters.ownerId,
        status: filters.status,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      }),
    [
      filters.ownerId,
      filters.queueId,
      filters.search,
      filters.sortBy,
      filters.sortOrder,
      filters.status,
    ],
  )
  const previousFiltersKeyRef = useRef(filtersKey)

  useEffect(() => {
    if (previousFiltersKeyRef.current === filtersKey) {
      return
    }

    previousFiltersKeyRef.current = filtersKey
    setSelectedIdSet(new Set())
    setBulkAssignOwnerId(null)
  }, [filtersKey])

  useEffect(() => {
    setSelectedIdSet((prev) => {
      if (prev.size === 0) {
        return prev
      }

      const visibleIds = new Set(allIds)
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)))

      if (next.size === prev.size) {
        return prev
      }

      if (next.size === 0) {
        setBulkAssignOwnerId(null)
      }

      return next
    })
  }, [allIds])

  const handleSelectRow = useCallback((id: string, selected: boolean) => {
    setSelectedIdSet((prev) => {
      const next = new Set(prev)

      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }

      return next
    })
  }, [])

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      setSelectedIdSet(selected ? new Set(allIds) : new Set())
    },
    [allIds],
  )

  const selectedIds = useMemo(() => Array.from(selectedIdSet), [selectedIdSet])

  const columns = useMemo(
    () =>
      createCaseColumns({
        userRole,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        onSort: handleSort,
        selectedIds: selectedIdSet,
        allIds,
        onSelectRow: handleSelectRow,
        onSelectAll: handleSelectAll,
        onOpenAssignOwner: setAssignOwnerCase,
        onOpenPriority: setPriorityCase,
      }),
    [
      userRole,
      allIds,
      filters.sortBy,
      filters.sortOrder,
      handleSelectAll,
      handleSelectRow,
      handleSort,
      selectedIdSet,
    ],
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

  const submitBulkAssign = useCallback(() => {
    if (selectedIds.length === 0) {
      return
    }

    bulkAssign.mutate(
      { ids: selectedIds, ownerId: bulkAssignOwnerId },
      {
        onSuccess: () => {
          setSelectedIdSet(new Set())
          setBulkAssignOwnerId(null)
        },
      },
    )
  }, [bulkAssign, bulkAssignOwnerId, selectedIds])

  const handleFetchNextPage = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const stateValue = useMemo<CasesTableState>(
    () => ({
      flatData,
      selectedIds,
      filters,
      hideOwnerFilter,
      hideStatusFilter,
      userRole,
      isLoading,
      totalCount,
      hasNextPage,
      isFetchingNextPage,
      queues,
      isQueuesLoading,
      users: caseUsers,
      isUsersLoading,
      bulkAssignOwnerId,
      isBulkAssignPending: bulkAssign.isPending,
      assignOwnerCase,
      priorityCase,
    }),
    [
      assignOwnerCase,
      bulkAssign.isPending,
      bulkAssignOwnerId,
      caseUsers,
      filters,
      flatData,
      hasNextPage,
      hideOwnerFilter,
      hideStatusFilter,
      isFetchingNextPage,
      isLoading,
      isQueuesLoading,
      isUsersLoading,
      priorityCase,
      queues,
      selectedIds,
      totalCount,
      userRole,
    ],
  )

  const actionsValue = useMemo<CasesTableActions>(
    () => ({
      setFilter,
      fetchNextPage: handleFetchNextPage,
      setBulkAssignOwnerId,
      submitBulkAssign,
      openAssignOwnerDialog: setAssignOwnerCase,
      closeAssignOwnerDialog: () => setAssignOwnerCase(null),
      openPriorityDialog: setPriorityCase,
      closePriorityDialog: () => setPriorityCase(null),
    }),
    [handleFetchNextPage, setFilter, submitBulkAssign],
  )

  const metaValue = useMemo<CasesTableMeta>(
    () => ({
      columns,
      selectedIdSet,
      commaToSet,
      setToCommaString,
    }),
    [columns, commaToSet, selectedIdSet, setToCommaString],
  )

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

export { CasesTableProvider }
