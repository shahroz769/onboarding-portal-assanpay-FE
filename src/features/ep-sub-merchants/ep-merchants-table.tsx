import { useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { format } from 'date-fns'
import { EyeIcon, ListChecks, ListRestart, Play, Store } from 'lucide-react'

import { TruncatedTooltip } from '#/components/truncated-tooltip'
import { EmptyState, FilteredEmptyState } from '#/components/empty-state'
import {
  DataTable,
  DataTableColumnHeader,
  DataTableFilter,
  DataTableSearch,
  DataTableToolbar,
} from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import { Badge } from '#/components/ui/badge'
import { Button, ButtonLink } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import {
  EP_MERCHANTS_KEY,
  epMerchantsInfiniteQueryOptions,
} from '#/hooks/use-ep-sub-merchants-query'
import { useMorph } from '#/hooks/use-morph'
import { useRetainedValue } from '#/hooks/use-retained-value'
import {
  caseStatusBadgeClasses,
  merchantStatusBadgeClasses,
  statusTint,
} from '#/lib/status-styles'
import { CASE_STATUS_LABELS } from '#/schemas/cases.schema'
import {
  DEFAULT_EP_PROGRESS_FILTER,
  DEFAULT_EP_WORDPRESS_FILTER,
  EP_FILTER_ALL,
  EP_MERCHANT_STATUSES,
  EP_PROGRESS_FILTERS,
  EP_PROGRESS_FILTER_LABELS,
  EP_WORDPRESS_FILTERS,
  EP_WORDPRESS_FILTER_LABELS,
} from '#/schemas/ep-sub-merchants.schema'
import type {
  EpMerchant,
  EpMerchantFilters,
  EpMerchantRouteSearch,
  EpMerchantSortableColumn,
} from '#/schemas/ep-sub-merchants.schema'
import { MERCHANT_STATUS_DISPLAY } from '#/schemas/merchants.schema'
import { EpCaseStatusSummary } from './ep-case-status'
import { EpTriggerDialog } from './ep-trigger-dialog'

const routeApi = getRouteApi('/_app/cases/ep-sub-merchants')

const statusFilterOptions = EP_MERCHANT_STATUSES.map((status) => ({
  label: MERCHANT_STATUS_DISPLAY[status],
  value: status,
}))
const wordpressFilterOptions = EP_WORDPRESS_FILTERS.map((value) => ({
  label: EP_WORDPRESS_FILTER_LABELS[value],
  value,
}))
const progressFilterOptions = EP_PROGRESS_FILTERS.map((value) => ({
  label: EP_PROGRESS_FILTER_LABELS[value],
  value,
}))

// ─── Filter values ──────────────────────────────────────────────────────────
// A filter missing from the URL uses its default, so clearing one is stored as
// "all" to tell the two apart.

function appliedFilter(value: string | undefined, defaultValue: string) {
  const applied = value ?? defaultValue
  return applied === EP_FILTER_ALL ? undefined : applied
}

function toSelectedSet(value: string | undefined) {
  return new Set(value?.split(',').filter(Boolean) ?? [])
}

function fromSelectedSet(set: Set<string>) {
  return set.size > 0 ? [...set].join(',') : EP_FILTER_ALL
}

// ─── Trigger state ──────────────────────────────────────────────────────────

function getTriggerState(merchant: EpMerchant) {
  const triggerable = merchant.subMerchants.filter(
    (subMerchant) => subMerchant.canTrigger,
  )

  if (triggerable.length > 0) {
    return {
      canTrigger: true,
      // Only a re-trigger when no sub-merchant is being triggered for the first time.
      label: triggerable.every((subMerchant) => subMerchant.latestCase)
        ? 'Re-trigger'
        : 'Trigger',
      reason: null,
    }
  }

  const isOpen = merchant.subMerchants.some(
    (subMerchant) =>
      subMerchant.latestCase && subMerchant.latestCase.status !== 'closed',
  )
  let reason = 'Every selected sub-merchant has a successful case.'
  if (!merchant.isEligible) {
    reason = 'The WordPress case must be closed as successful first.'
  } else if (merchant.subMerchants.length === 0) {
    reason = 'No sub-merchant was selected in Documents Review.'
  } else if (isOpen) {
    reason = 'EP cases are already open for every selected sub-merchant.'
  }

  return { canTrigger: false, label: 'Trigger', reason }
}

function getStatusEntries(merchant: EpMerchant) {
  return [
    ...merchant.subMerchants.map((subMerchant) => ({
      key: subMerchant.id,
      name: subMerchant.name,
      epCase: subMerchant.latestCase,
    })),
    ...merchant.otherCases.map((epCase) => ({
      key: epCase.id,
      name: epCase.subMerchantName,
      epCase,
    })),
  ]
}

function getSubMerchantSubtitle(merchant: EpMerchant) {
  const entries = getStatusEntries(merchant)
  const [onlyEntry] = entries
  if (entries.length > 1) return `${entries.length} sub-merchants`
  return onlyEntry?.name ?? null
}

function WordpressBadge({ merchant }: { merchant: EpMerchant }) {
  const { wordpress } = merchant

  if (!wordpress) {
    return <Badge className={statusTint('neutral')}>No Case</Badge>
  }
  if (wordpress.isSuccessful) {
    return <Badge className={statusTint('emerald')}>Successful</Badge>
  }
  return (
    <Badge
      variant="secondary"
      className={caseStatusBadgeClasses(
        wordpress.status,
        wordpress.closeOutcome,
      )}
    >
      {wordpress.status === 'closed'
        ? 'Unsuccessful'
        : CASE_STATUS_LABELS[wordpress.status]}
    </Badge>
  )
}

// ─── Columns ────────────────────────────────────────────────────────────────

function createColumns({
  sortBy,
  sortOrder,
  onSort,
  onTrigger,
}: {
  sortBy: EpMerchantSortableColumn
  sortOrder: 'asc' | 'desc'
  onSort: (column: EpMerchantSortableColumn) => void
  onTrigger: (merchant: EpMerchant, trigger: HTMLElement) => void
}): DataTableColumnDef<EpMerchant>[] {
  const sortDirection = (column: EpMerchantSortableColumn) =>
    sortBy === column ? sortOrder : false
  const sortableHeader = (column: EpMerchantSortableColumn, title: string) => (
    <DataTableColumnHeader
      title={title}
      sortDirection={sortDirection(column)}
      onSort={() => onSort(column)}
    />
  )

  return [
    {
      id: 'businessName',
      sortDirection: sortDirection('businessName'),
      header: sortableHeader('businessName', 'Merchant Name'),
      cell: (merchant) => {
        const subtitle = getSubMerchantSubtitle(merchant)

        return (
          <TruncatedTooltip
            render={<div className="flex max-w-72 flex-col gap-0.5" />}
            content={
              <>
                {merchant.businessName}
                {subtitle ? ` · ${subtitle}` : null}
              </>
            }
          >
            <Link
              to="/merchants/$merchantId/overview"
              params={{ merchantId: merchant.id }}
              className="block truncate font-medium text-foreground hover:underline hover:decoration-dashed hover:underline-offset-4"
            >
              {merchant.businessName}
            </Link>
            {subtitle ? (
              <span className="truncate text-xs text-muted-foreground">
                {subtitle}
              </span>
            ) : null}
          </TruncatedTooltip>
        )
      },
      width: 300,
    },
    {
      id: 'ownerFullName',
      sortDirection: sortDirection('ownerFullName'),
      header: sortableHeader('ownerFullName', 'Owner'),
      cell: (merchant) => (
        <TruncatedTooltip
          render={<span className="block max-w-52 truncate text-sm" />}
          content={merchant.ownerFullName}
          focusable
        >
          {merchant.ownerFullName}
        </TruncatedTooltip>
      ),
      width: 220,
    },
    {
      id: 'status',
      sortDirection: sortDirection('status'),
      header: sortableHeader('status', 'Status'),
      cell: (merchant) => (
        <Badge className={merchantStatusBadgeClasses(merchant.status)}>
          {MERCHANT_STATUS_DISPLAY[merchant.status]}
        </Badge>
      ),
      width: 120,
    },
    {
      id: 'wordpress',
      header: 'WordPress',
      cell: (merchant) => <WordpressBadge merchant={merchant} />,
      width: 120,
    },
    {
      id: 'epStatus',
      header: 'EP Status',
      cell: (merchant) => {
        const entries = getStatusEntries(merchant)

        return entries.length > 0 ? (
          <EpCaseStatusSummary entries={entries} />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )
      },
      width: 300,
    },
    {
      id: 'createdAt',
      sortDirection: sortDirection('createdAt'),
      header: sortableHeader('createdAt', 'Created At'),
      cell: (merchant) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(merchant.createdAt), 'MMM dd, yyyy h:mm a')}
        </span>
      ),
      width: 180,
    },
    {
      id: 'updatedAt',
      sortDirection: sortDirection('updatedAt'),
      header: sortableHeader('updatedAt', 'Last Updated'),
      cell: (merchant) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(merchant.updatedAt), 'MMM dd, yyyy h:mm a')}
        </span>
      ),
      width: 180,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (merchant) => {
        const { canTrigger, label, reason } = getTriggerState(merchant)

        return (
          <div className="flex items-center gap-1">
            <ButtonLink
              variant="ghost"
              size="icon"
              className="size-8"
              render={
                <Link
                  to="/merchants/$merchantId/overview"
                  params={{ merchantId: merchant.id }}
                />
              }
            >
              <EyeIcon className="size-4" />
              <span className="sr-only">View {merchant.businessName}</span>
            </ButtonLink>
            {canTrigger ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={(event) =>
                        onTrigger(merchant, event.currentTarget)
                      }
                    />
                  }
                >
                  <Play className="size-4" />
                  <span className="sr-only">
                    {label} EP case for {merchant.businessName}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{label} EP Case</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={<span tabIndex={0} className="inline-flex" />}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled
                    aria-label={`Trigger EP case for ${merchant.businessName}: ${reason}`}
                  >
                    <Play className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{reason}</TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      },
      width: 140,
    },
  ]
}

// ─── Table ──────────────────────────────────────────────────────────────────

export function EpMerchantsTable() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const queryClient = useQueryClient()
  const [triggerMerchant, setTriggerMerchant] = useState<EpMerchant | null>(
    null,
  )
  const dialogMerchant = useRetainedValue(triggerMerchant)
  const triggerMorph = useMorph()

  const setSearch = (partial: Partial<EpMerchantRouteSearch>) => {
    void navigate({
      search: (prev) => ({ ...prev, ...partial }),
      replace: true,
    })
  }

  const handleSort = (column: EpMerchantSortableColumn) => {
    const isSameColumn = search.sortBy === column
    if (!isSameColumn) {
      queryClient.removeQueries({ queryKey: EP_MERCHANTS_KEY })
    }
    setSearch({
      sortBy: column,
      sortOrder: isSameColumn && search.sortOrder === 'asc' ? 'desc' : 'asc',
    })
  }

  const wordpressFilter = appliedFilter(
    search.wordpress,
    DEFAULT_EP_WORDPRESS_FILTER,
  )
  const progressFilter = appliedFilter(
    search.progress,
    DEFAULT_EP_PROGRESS_FILTER,
  )
  const queryFilters: EpMerchantFilters = {
    search: search.search,
    status: search.status === EP_FILTER_ALL ? undefined : search.status,
    wordpress: wordpressFilter,
    progress: progressFilter,
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
  }

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
  } = useInfiniteQuery(epMerchantsInfiniteQueryOptions(queryFilters))

  const merchants = data?.pages.flatMap((page) => page.merchants) ?? []
  const totalCount = data?.pages[0]?.total ?? null

  const isDefaultView = !search.wordpress && !search.progress && !search.status
  const resetFilters = () =>
    setSearch({
      search: undefined,
      status: undefined,
      wordpress: undefined,
      progress: undefined,
    })
  const showAllMerchants = () =>
    setSearch({
      status: undefined,
      wordpress: EP_FILTER_ALL,
      progress: EP_FILTER_ALL,
    })

  const columns = createColumns({
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
    onSort: handleSort,
    onTrigger: (merchant, trigger) =>
      triggerMorph.run(() => setTriggerMerchant(merchant), trigger),
  })

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="shrink-0">
          <DataTableToolbar>
            <DataTableToolbar.Filters>
              <DataTableSearch
                value={search.search ?? ''}
                onChange={(value) => setSearch({ search: value || undefined })}
                label="Search merchants"
                placeholder="Search by ID or name…"
              />
              <DataTableFilter
                title="EP Progress"
                options={progressFilterOptions}
                selectedValues={toSelectedSet(progressFilter)}
                onChange={(set) =>
                  setSearch({ progress: fromSelectedSet(set) })
                }
              />
              <DataTableFilter
                title="WordPress"
                options={wordpressFilterOptions}
                selectedValues={toSelectedSet(wordpressFilter)}
                onChange={(set) =>
                  setSearch({ wordpress: fromSelectedSet(set) })
                }
              />
              <DataTableFilter
                title="Status"
                options={statusFilterOptions}
                selectedValues={toSelectedSet(queryFilters.status)}
                onChange={(set) =>
                  setSearch({
                    status: set.size > 0 ? [...set].join(',') : undefined,
                  })
                }
              />
            </DataTableToolbar.Filters>
            <DataTableToolbar.Actions>
              {isDefaultView ? (
                <Button size="sm" variant="outline" onClick={showAllMerchants}>
                  <ListChecks data-icon="inline-start" />
                  Show All Merchants
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSearch({
                      status: undefined,
                      wordpress: undefined,
                      progress: undefined,
                    })
                  }
                >
                  <ListRestart data-icon="inline-start" />
                  Reset to Work List
                </Button>
              )}
            </DataTableToolbar.Actions>
          </DataTableToolbar>
        </div>
        <div className="min-h-0 flex-1">
          <DataTable
            columns={columns}
            data={merchants}
            getRowId={(merchant) => merchant.id}
            isLoading={isLoading || (isFetching && isPlaceholderData)}
            error={error}
            onRetry={() => void refetch()}
            onScrollEnd={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
            }}
            isFetchingMore={isFetchingNextPage}
            hasMore={hasNextPage}
            totalCount={totalCount}
            emptyContent={
              search.search || !isDefaultView ? (
                <FilteredEmptyState
                  noun="merchants"
                  search={search.search}
                  hasOtherFilters={!isDefaultView}
                  onClearFilters={resetFilters}
                />
              ) : (
                <EmptyState
                  icon={Store}
                  tone="success"
                  title="No merchants need an EP case right now."
                  description="Merchants appear here once their WordPress case closes as successful."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={showAllMerchants}
                    >
                      Show All Merchants
                    </Button>
                  }
                />
              )
            }
          />
        </div>
        <EpTriggerDialog
          merchant={dialogMerchant}
          open={triggerMerchant !== null}
          onOpenChange={(open) => {
            if (!open) setTriggerMerchant(null)
          }}
          popupProps={triggerMorph.popupProps}
        />
      </div>
    </TooltipProvider>
  )
}
