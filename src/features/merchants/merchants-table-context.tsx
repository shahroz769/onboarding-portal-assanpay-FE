import { createContext, use, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'

import { useAuth } from '#/features/auth/auth-client'
import {
  MERCHANTS_KEY,
  merchantsInfiniteQueryOptions,
  useBulkPriorityMutation,
  useBulkTerminateMutation,
  usePermanentlyDeleteMerchantMutation,
  useTerminateMerchantMutation,
  useUpdatePriorityMutation,
} from '#/hooks/use-merchants-query'
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import type {
  MerchantFilters,
  MerchantListItem,
  MerchantRouteSearch,
  MerchantSortableColumn,
  Priority,
} from '#/schemas/merchants.schema'
import { DEFAULT_MERCHANT_STATUS_FILTER } from '#/schemas/merchants.schema'
import type { RoleType } from '#/types/auth'
import { createMerchantColumns } from './merchants-columns'
import type { MerchantPriorityTarget } from './merchants-priority-dialog'
import type { TerminateTarget } from './merchants-terminate-dialog'
import { selectedNonTerminatedIds } from './merchants-table-utils'

interface MerchantsTableState {
  flatData: MerchantListItem[]
  selectedIds: string[]
  filters: MerchantRouteSearch
  userRole: RoleType
  isLoading: boolean
  error: Error | null
  totalCount: number | null
  hasNextPage: boolean
  isFetchingNextPage: boolean
  priorityTarget: MerchantPriorityTarget | null
  terminateTarget: TerminateTarget | null
  deleteTarget: MerchantListItem | null
  isPriorityPending: boolean
  isTerminatePending: boolean
  isDeletePending: boolean
  isBulkPriorityPending: boolean
}

interface MerchantsTableActions {
  setFilter: (key: keyof MerchantRouteSearch, value: string | undefined) => void
  fetchNextPage: () => void
  retry: () => void
  openPriorityDialog: (merchant: MerchantListItem) => void
  closePriorityDialog: () => void
  openBulkPriorityDialog: () => void
  openTerminateDialog: (target: TerminateTarget) => void
  closeTerminateDialog: () => void
  closeDeleteDialog: () => void
  submitPriority: (priority: Priority, note?: string) => void
  confirmTerminate: (reason: string) => void
  confirmDelete: (confirmation: string) => void
}

interface MerchantsTableMeta {
  columns: DataTableColumnDef<MerchantListItem>[]
  selectedIdSet: Set<string>
  commaToSet: (value: string | undefined) => Set<string>
  setToCommaString: (set: Set<string>) => string | undefined
}

const MerchantsTableStateContext = createContext<MerchantsTableState | null>(
  null,
)
const MerchantsTableActionsContext =
  createContext<MerchantsTableActions | null>(null)
const MerchantsTableMetaContext = createContext<MerchantsTableMeta | null>(null)

function useRequiredContext<T>(context: React.Context<T | null>) {
  const value = use(context)

  if (!value) {
    throw new Error(
      'useMerchantsTable must be used within MerchantsTable.Provider',
    )
  }

  return value
}

export function useMerchantsTableState() {
  return useRequiredContext(MerchantsTableStateContext)
}

export function useMerchantsTableActions() {
  return useRequiredContext(MerchantsTableActionsContext)
}

export function useMerchantsTableMeta() {
  return useRequiredContext(MerchantsTableMetaContext)
}

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

const routeApi = getRouteApi('/_app/merchants/')

function useMerchantFilters() {
  const navigate = useNavigate()
  const filters = routeApi.useSearch()

  const setFilters = (partialFilters: Partial<MerchantRouteSearch>) => {
    void navigate({
      to: '/merchants',
      search: (prev) =>
        cleanEmptyParams({
          ...prev,
          ...partialFilters,
        }) as MerchantRouteSearch,
      replace: true,
    })
  }

  const setFilter = (
    key: keyof MerchantRouteSearch,
    value: string | undefined,
  ) => {
    setFilters({ [key]: value || undefined })
  }

  return { filters, setFilters, setFilter }
}

function MerchantsTableProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userRole = user?.roleType ?? 'agent'
  const { filters, setFilter, setFilters } = useMerchantFilters()

  const handleSort = (columnId: MerchantSortableColumn) => {
    const isSameColumn = filters.sortBy === columnId
    const nextOrder =
      isSameColumn && filters.sortOrder === 'asc' ? 'desc' : 'asc'

    if (!isSameColumn) {
      queryClient.removeQueries({ queryKey: MERCHANTS_KEY })
    }

    setFilters({ sortBy: columnId, sortOrder: nextOrder })
  }

  const [selectedIdSet, setSelectedIdSet] = useState<Set<string>>(new Set())
  const [priorityTarget, setPriorityTarget] =
    useState<MerchantPriorityTarget | null>(null)
  const [terminateTarget, setTerminateTarget] =
    useState<TerminateTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MerchantListItem | null>(
    null,
  )
  const queryFilters: MerchantFilters = {
    ...filters,
    status: filters.status ?? DEFAULT_MERCHANT_STATUS_FILTER,
    createdAtFrom: undefined,
    createdAtTo: undefined,
  }

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(merchantsInfiniteQueryOptions(queryFilters))

  const isTableLoading = isLoading || (isFetching && !isFetchingNextPage)

  const updatePriority = useUpdatePriorityMutation()
  const terminateMerchant = useTerminateMerchantMutation()
  const bulkTerminate = useBulkTerminateMutation()
  const permanentlyDeleteMerchant = usePermanentlyDeleteMerchantMutation()
  const bulkPriority = useBulkPriorityMutation()

  const flatData = data?.pages.flatMap((page) => page.merchants) ?? []

  const totalCount = data?.pages[0]?.total ?? null
  const allIds = flatData.map((merchant) => merchant.id)

  const handleSelectRow = (id: string, selected: boolean) => {
    setSelectedIdSet((prev) => {
      const next = new Set(prev)

      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }

      return next
    })
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedIdSet(selected ? new Set(allIds) : new Set())
  }

  const selectedIds = Array.from(selectedIdSet)

  const columns = createMerchantColumns({
    userRole,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    onSort: handleSort,
    selectedIds: selectedIdSet,
    allIds,
    onSelectRow: handleSelectRow,
    onSelectAll: handleSelectAll,
    onPriorityClick: (merchant) => {
      if (merchant.status !== 'terminated') {
        setPriorityTarget({ type: 'single', merchant })
      }
    },
    onTerminateClick: (merchant) =>
      setTerminateTarget({ type: 'single', merchant }),
    onDeleteClick: (merchant) => {
      if (merchant.status === 'terminated') {
        setDeleteTarget(merchant)
      }
    },
  })

  const commaToSet = (value: string | undefined) =>
    new Set(value?.split(',').filter(Boolean) ?? [])

  const setToCommaString = (set: Set<string>) =>
    set.size > 0 ? Array.from(set).join(',') : undefined

  const submitPriority = (priority: Priority, note?: string) => {
    if (!priorityTarget) {
      return
    }

    if (
      priorityTarget.type === 'single' &&
      priorityTarget.merchant.status === 'terminated'
    ) {
      return
    }

    if (priorityTarget.type === 'bulk') {
      bulkPriority.mutate(
        { ids: priorityTarget.ids, priority, note },
        {
          onSuccess: () => {
            setPriorityTarget(null)
            setSelectedIdSet(new Set())
          },
        },
      )

      return
    }

    updatePriority.mutate(
      { merchantId: priorityTarget.merchant.id, priority, note },
      { onSuccess: () => setPriorityTarget(null) },
    )
  }

  const confirmTerminate = (reason: string) => {
    if (!terminateTarget) {
      return
    }

    if (terminateTarget.type === 'single') {
      terminateMerchant.mutate(
        { merchantId: terminateTarget.merchant.id, reason },
        {
          onSuccess: () => {
            setTerminateTarget(null)
            setSelectedIdSet(new Set())
          },
        },
      )

      return
    }

    bulkTerminate.mutate(
      { ids: terminateTarget.ids, reason },
      {
        onSuccess: () => {
          setTerminateTarget(null)
          setSelectedIdSet(new Set())
        },
      },
    )
  }

  const confirmDelete = (confirmation: string) => {
    if (!deleteTarget || deleteTarget.status !== 'terminated') return

    const merchantId = deleteTarget.id
    permanentlyDeleteMerchant.mutate(
      { merchantId, confirmation },
      {
        onSuccess: () => {
          setDeleteTarget(null)
          setSelectedIdSet((selected) => {
            const next = new Set(selected)
            next.delete(merchantId)
            return next
          })
        },
      },
    )
  }

  const handleFetchNextPage = () => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }

  const stateValue: MerchantsTableState = {
    flatData,
    selectedIds,
    filters,
    userRole,
    isLoading: isTableLoading,
    error,
    totalCount,
    hasNextPage,
    isFetchingNextPage,
    priorityTarget,
    terminateTarget,
    deleteTarget,
    isPriorityPending: updatePriority.isPending,
    isTerminatePending: terminateMerchant.isPending || bulkTerminate.isPending,
    isDeletePending: permanentlyDeleteMerchant.isPending,
    isBulkPriorityPending: bulkPriority.isPending,
  }

  const actionsValue: MerchantsTableActions = {
    setFilter,
    fetchNextPage: handleFetchNextPage,
    retry: () => void refetch(),
    openPriorityDialog: (merchant) => {
      if (merchant.status !== 'terminated') {
        setPriorityTarget({ type: 'single', merchant })
      }
    },
    closePriorityDialog: () => setPriorityTarget(null),
    openBulkPriorityDialog: () => {
      const ids = selectedNonTerminatedIds(selectedIds, flatData)

      if (ids.length === 0) return

      setPriorityTarget({
        type: 'bulk',
        ids,
        initialPriority: 'normal',
      })
    },
    openTerminateDialog: setTerminateTarget,
    closeTerminateDialog: () => setTerminateTarget(null),
    closeDeleteDialog: () => setDeleteTarget(null),
    submitPriority,
    confirmTerminate,
    confirmDelete,
  }

  const metaValue: MerchantsTableMeta = {
    columns,
    selectedIdSet,
    commaToSet,
    setToCommaString,
  }

  return (
    <MerchantsTableStateContext value={stateValue}>
      <MerchantsTableActionsContext value={actionsValue}>
        <MerchantsTableMetaContext value={metaValue}>
          {children}
        </MerchantsTableMetaContext>
      </MerchantsTableActionsContext>
    </MerchantsTableStateContext>
  )
}

export { MerchantsTableProvider }
