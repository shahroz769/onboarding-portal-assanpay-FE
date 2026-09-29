import { useEffect, useRef } from 'react'
import { AlertTriangle, RefreshCw, SearchX } from 'lucide-react'

import { cn } from '#/lib/utils'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { Button } from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { ScrollArea } from '#/components/ui/scroll-area'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import { EmptyState } from '#/components/empty-state'

// ─── Column Definition ──────────────────────────────────────────────────────

export interface DataTableColumnDef<TData> {
  id: string
  header: React.ReactNode
  cell: (item: TData) => React.ReactNode
  width?: number
  /** Current sort of a sortable column (false when sortable but unsorted). */
  sortDirection?: 'asc' | 'desc' | false
}

function getAriaSort(
  sortDirection: 'asc' | 'desc' | false | undefined,
): React.AriaAttributes['aria-sort'] {
  if (sortDirection === undefined) return undefined
  if (sortDirection === 'asc') return 'ascending'
  if (sortDirection === 'desc') return 'descending'
  return 'none'
}

// ─── Props ──────────────────────────────────────────────────────────────────

function DataTableCellSkeleton({
  columnId,
  width = 140,
  rowIndex,
}: {
  columnId: string
  width?: number
  rowIndex: number
}) {
  if (columnId === 'select') {
    return <Skeleton className="size-4 rounded-lg" />
  }

  if (columnId === 'actions') {
    return (
      <div className="flex items-center gap-1">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    )
  }

  if (
    columnId === 'queueName' ||
    columnId === 'status' ||
    columnId === 'priority'
  ) {
    return (
      <Skeleton
        className="h-5 rounded-md"
        style={{ width: Math.min(width - 24, 96) }}
      />
    )
  }

  if (
    columnId === 'createdAt' ||
    columnId === 'closedAt' ||
    columnId === 'updatedAt'
  ) {
    return (
      <Skeleton className="h-4" style={{ width: Math.min(width - 24, 136) }} />
    )
  }

  const widthOffset = rowIndex % 3 === 0 ? 32 : rowIndex % 3 === 1 ? 48 : 24

  return (
    <Skeleton
      className="h-4"
      style={{ width: Math.max(Math.min(width - widthOffset, width), 36) }}
    />
  )
}

interface DataTableProps<TData> {
  columns: DataTableColumnDef<TData>[]
  data: TData[]
  getRowId: (row: TData) => string
  /** Set of selected row IDs */
  selectedIds?: Set<string>
  /** Whether initial data is loading */
  isLoading?: boolean
  /** Empty state content */
  emptyContent?: React.ReactNode
  /** Query error; shown in place of the empty state when there are no rows */
  error?: unknown
  /** Called from the error state's Retry button */
  onRetry?: () => void
  /** Called when the scroll sentinel becomes visible */
  onScrollEnd?: () => void
  /** Whether more data is currently being fetched */
  isFetchingMore?: boolean
  /** Whether there are more pages to fetch */
  hasMore?: boolean
  /** Total rows matching the current filters, when the API reports it */
  totalCount?: number | null
  /** Extra classes for the outer container (e.g. cap height in cards) */
  className?: string
}

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  selectedIds,
  isLoading = false,
  emptyContent,
  error = null,
  onRetry,
  onScrollEnd,
  isFetchingMore = false,
  hasMore = false,
  totalCount = null,
  className,
}: DataTableProps<TData>) {
  const showEndOfResults = !!onScrollEnd && !hasMore && !isFetchingMore
  const sentinelRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onScrollEnd || !sentinelRef.current) return

    const sentinel = sentinelRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isFetchingMore) {
          onScrollEnd()
        }
      },
      {
        root: viewportRef.current,
        rootMargin: '200px',
      },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [onScrollEnd, hasMore, isFetchingMore])

  // Column widths for the fixed-layout table (and the header-only table the
  // empty state shows).
  const columnGroup = (
    <colgroup>
      {columns.map((col) => (
        <col
          key={col.id}
          style={col.width ? { width: col.width } : undefined}
        />
      ))}
    </colgroup>
  )

  // Header and rows share one table so screen readers announce each cell with
  // its column. The header cells stick to the top of the scroll area; the
  // inset shadow is their bottom border (collapsed borders don't stick).
  const tableHead = (
    <TableHeader className="[&_tr]:border-b-0">
      <TableRow className="hover:bg-transparent">
        {columns.map((col) => (
          <TableHead
            key={col.id}
            aria-sort={getAriaSort(col.sortDirection)}
            className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_var(--border)]"
          >
            {col.header}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )

  // The overlay scrollbar starts below the sticky header row (h-10).
  const scrollbarClassName = 'mt-10'

  if (isLoading) {
    return (
      <div
        className={cn(
          'view-transition-none flex h-full flex-col overflow-hidden rounded-md border bg-card',
          className,
        )}
      >
        <ScrollArea
          className="min-h-0 flex-1"
          verticalScrollbarClassName={scrollbarClassName}
        >
          <Table className="table-fixed" aria-busy="true">
            {columnGroup}
            {tableHead}
            <TableBody>
              {Array.from({ length: 10 }).map((_, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="h-12 content-visibility-auto contain-intrinsic-size-auto-48px"
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} className="h-12 py-0">
                      <DataTableCellSkeleton
                        columnId={column.id}
                        width={column.width}
                        rowIndex={rowIndex}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'view-transition-none flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-card',
          className,
        )}
      >
        <div className="shrink-0">
          <Table className="table-fixed">
            {columnGroup}
            {tableHead}
          </Table>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {error ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load results."
              description={getApiErrorMessage(error)}
              action={
                onRetry ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                  >
                    <RefreshCw data-icon="inline-start" />
                    Retry
                  </Button>
                ) : null
              }
            />
          ) : (
            (emptyContent ?? (
              <EmptyState
                icon={SearchX}
                title="No results found."
                description="Try adjusting your search or filters."
              />
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'view-transition-none flex h-full flex-col overflow-hidden rounded-md border bg-card',
        className,
      )}
    >
      <ScrollArea
        className="min-h-0 flex-1"
        viewportRef={viewportRef}
        viewportClassName={showEndOfResults ? 'flex flex-col' : undefined}
        verticalScrollbarClassName={scrollbarClassName}
      >
        <Table className="table-fixed">
          {columnGroup}
          {tableHead}
          <TableBody>
            {data.map((item) => {
              const rowId = getRowId(item)
              const isSelected = selectedIds?.has(rowId) ?? false
              return (
                <TableRow
                  key={rowId}
                  data-state={isSelected ? 'selected' : undefined}
                  className={cn(
                    'h-12 content-visibility-auto contain-intrinsic-size-auto-48px',
                    isSelected && 'bg-muted/50',
                  )}
                >
                  {columns.map((col) => (
                    <TableCell key={col.id} className="h-12 py-0">
                      {col.cell(item)}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
            {isFetchingMore && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    Loading more…
                  </div>
                </TableCell>
              </TableRow>
            )}
            {onScrollEnd && (
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-px p-0">
                  <div ref={sentinelRef} className="h-px" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {/* Fills the space below the last row so the marker sits centered in it */}
        {showEndOfResults && (
          <div className="flex flex-1 items-center justify-center px-4 py-6 text-sm text-muted-foreground">
            End of results
          </div>
        )}
      </ScrollArea>
      {onScrollEnd && (
        <div
          aria-live="polite"
          className="shrink-0 border-t bg-muted px-3 py-2 text-xs text-muted-foreground tabular-nums"
        >
          {totalCount === null
            ? `Showing ${data.length} ${data.length === 1 ? 'row' : 'rows'}`
            : `Showing ${data.length} of ${totalCount}`}
        </div>
      )}
    </div>
  )
}
