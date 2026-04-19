import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'

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
  Queue,
} from '#/schemas/cases.schema'
import type { RoleType, User } from '#/types/auth'
import { createCaseColumns } from './cases-columns'

// ─── Context Types ──────────────────────────────────────────────────────────

interface CasesTableState {
  flatData: CaseListItem[]
  selectedIds: string[]
  filters: CaseRouteSearch
  userRole: RoleType
  isLoading: boolean
  totalCount: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  queues: Queue[]
  isQueuesLoading: boolean
  users: User[]
  bulkAssignOwnerId: string | null
  isBulkAssignPending: boolean
}

interface CasesTableActions {
  setFilter: (key: keyof CaseRouteSearch, value: string | undefined) => void
  fetchNextPage: () => void
  setBulkAssignOwnerId: (value: string | null) => void
  submitBulkAssign: () => void
}

interface CasesTableMeta {
  columns: DataTableColumnDef<CaseListItem>[]
  selectedIdSet: Set<string>
  commaToSet: (value: string | undefined) => Set<string>
  setToCommaString: (set: Set<string>) => string | undefined
}

const CasesTableStateContext = createContext<CasesTableState | null>(null)
const CasesTableActionsContext = createContext<CasesTableActions | null>(null)
const CasesTableMetaContext = createContext<CasesTableMeta | null>(null)

function useRequiredContext<T>(context: React.Context<T | null>) {
  const value = use(context)

  if (!value) {
    throw new Error(
      'useCasesTable must be used within CasesTable.Provider',
    )
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function cleanEmptyParams(search: Record<string, unknown>) {
  const cleaned = { ...search }

  for (const key of Object.keys(cleaned)) {
    const value = cleaned[key]

    if (
      value === undefined ||
      value === '' ||
      (typeof value === 'number' && Number.isNaN(value))
    ) {
      delete cleaned[key]
    }
  }

  return cleaned
}

const routeApi = getRouteApi('/_app/cases/all-cases')

function useCaseFilters() {
  const navigate = useNavigate()
  const filters = routeApi.useSearch()

  const setFilters = useCallback(
    (partialFilters: Partial<CaseRouteSearch>) => {
      void navigate({
        to: '/cases/all-cases',
        search: (prev) =>
          cleanEmptyParams({
            ...prev,
            ...partialFilters,
          }) as CaseRouteSearch,
        replace: true,
      })
    },
    [navigate],
  )

  const setFilter = useCallback(
    (key: keyof CaseRouteSearch, value: string | undefined) => {
      setFilters({ [key]: value || undefined })
    },
    [setFilters],
  )

  return { filters, setFilters, setFilter }
}

// ─── Provider ───────────────────────────────────────────────────────────────

function CasesTableProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userRole = user?.roleType ?? 'employee'
  const { filters, setFilter, setFilters } = useCaseFilters()

  const handleSort = useCallback(
    (columnId: string) => {
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
  const [bulkAssignOwnerId, setBulkAssignOwnerId] = useState<string | null>(null)

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(casesInfiniteQueryOptions(filters))

  const { data: queues = [], isLoading: isQueuesLoading } = useQuery(
    queuesQueryOptions(),
  )

  const { data: caseUsers = [] } = useQuery(usersQueryOptions())

  const bulkAssign = useBulkAssignCasesMutation()

  const flatData = useMemo(
    () => data?.pages.flatMap((page) => page.cases) ?? [],
    [data],
  )
  const totalCount = data?.pages[0]?.totalCount ?? 0
  const allIds = useMemo(
    () => flatData.map((c) => c.id),
    [flatData],
  )

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
    bulkAssign.mutate(
      { ids: selectedIds, ownerId: bulkAssignOwnerId },
      { onSuccess: () => setSelectedIdSet(new Set()) },
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
      userRole,
      isLoading,
      totalCount,
      hasNextPage,
      isFetchingNextPage,
      queues,
      isQueuesLoading,
      users: caseUsers,
      bulkAssignOwnerId,
      isBulkAssignPending: bulkAssign.isPending,
    }),
    [
      bulkAssign.isPending,
      bulkAssignOwnerId,
      caseUsers,
      filters,
      flatData,
      hasNextPage,
      isFetchingNextPage,
      isLoading,
      isQueuesLoading,
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
