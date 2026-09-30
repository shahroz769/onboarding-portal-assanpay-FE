import { memo, useEffect, useEffectEvent, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
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
import { TruncatedTooltipGroup } from '#/components/truncated-tooltip'

// ─── Column Definition ──────────────────────────────────────────────────────

export interface DataTableCellContext {
  isSelected: boolean
}

export interface DataTableColumnDef<TData> {
  id: string
  header: React.ReactNode
  /**
   * Renders one cell. Read row selection from `context` rather than closing
   * over the selected set, so selecting a row doesn't re-render every row.
   */
  cell: (item: TData, context: DataTableCellContext) => React.ReactNode
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

// ─── Virtualized Body ───────────────────────────────────────────────────────

// Matches the rows' h-12 and the header's h-10.
const ROW_HEIGHT = 48
const HEADER_HEIGHT = 40
// Rows kept mounted beyond each edge of the viewport.
const OVERSCAN_ROWS = 10
// The next page starts loading once the last mounted row is this close to the
// end of the loaded rows (about half a page ahead of the viewport).
const LOAD_MORE_THRESHOLD_ROWS = 15

interface DataTableRowProps<TData> {
  item: TData
  index: number
  columns: DataTableColumnDef<TData>[]
  isSelected: boolean
  measureRef: (node: HTMLTableRowElement | null) => void
}

// Memoized so a new page or a selection change only renders the rows it
// touches; the body around it re-renders on every scrolled range.
const DataTableRow = memo(function DataTableRow<TData>({
  item,
  index,
  columns,
  isSelected,
  measureRef,
}: DataTableRowProps<TData>) {
  return (
    <TableRow
      ref={measureRef}
      data-index={index}
      aria-rowindex={index + 2}
      data-state={isSelected ? 'selected' : undefined}
      className={cn('h-12', isSelected && 'bg-muted/50')}
    >
      {columns.map((col) => (
        <TableCell key={col.id} className="h-12 py-0">
          {col.cell(item, { isSelected })}
        </TableCell>
      ))}
    </TableRow>
  )
}) as <TData>(props: DataTableRowProps<TData>) => React.ReactNode

interface DataTableBodyProps<TData> {
  scrollElement: HTMLDivElement | null
  columns: DataTableColumnDef<TData>[]
  data: TData[]
  getRowId: (row: TData) => string
  selectedIds?: Set<string>
  onScrollEnd?: () => void
  isFetchingMore: boolean
  hasMore: boolean
}

/**
 * Mounts only the rows near the viewport, with spacer rows standing in for
 * the rest so the scroll height and the one-table layout stay intact.
 */
function DataTableBody<TData>({
  scrollElement,
  columns,
  data,
  getRowId,
  selectedIds,
  onScrollEnd,
  isFetchingMore,
  hasMore,
}: DataTableBodyProps<TData>) {
  // The virtualizer is one mutable instance; compiler memoization would keep
  // serving the rows of the first scroll position.
  'use no memo'

  // Expected: compilation is skipped here on purpose (see above). Only the
  // instance's stable `measureElement` reaches the memoized rows.
  // react-doctor-disable-next-line react-hooks-js/incompatible-library
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => getRowId(data[index]),
    // The sticky header sits above the first row inside the scroll area.
    scrollMargin: HEADER_HEIGHT,
    overscan: OVERSCAN_ROWS,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const firstRow = virtualRows.at(0)
  const lastRow = virtualRows.at(-1)
  const paddingTop = firstRow ? firstRow.start - HEADER_HEIGHT : 0
  const paddingBottom = lastRow
    ? virtualizer.getTotalSize() - (lastRow.end - HEADER_HEIGHT)
    : 0

  const lastRenderedIndex = lastRow?.index ?? -1
  const canLoadMore = !!onScrollEnd && hasMore && !isFetchingMore
  const loadMore = useEffectEvent(() => onScrollEnd?.())

  useEffect(() => {
    if (!canLoadMore || lastRenderedIndex === -1) return
    if (lastRenderedIndex >= data.length - 1 - LOAD_MORE_THRESHOLD_ROWS) {
      loadMore()
    }
  }, [canLoadMore, lastRenderedIndex, data.length])

  return (
    <TableBody>
      {paddingTop > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={columns.length}
            className="p-0"
            style={{ height: paddingTop }}
          />
        </tr>
      )}
      {virtualRows.map((virtualRow) => {
        const item = data[virtualRow.index]
        return (
          <DataTableRow
            key={virtualRow.key}
            item={item}
            index={virtualRow.index}
            columns={columns}
            isSelected={selectedIds?.has(getRowId(item)) ?? false}
            measureRef={virtualizer.measureElement}
          />
        )
      })}
      {/* Always present under infinite scroll (as the old sentinel was), so
          the last loaded row keeps its bottom border above the footer. */}
      {(paddingBottom > 0 || onScrollEnd) && (
        <tr aria-hidden="true">
          <td
            colSpan={columns.length}
            className="p-0"
            style={{ height: paddingBottom }}
          />
        </tr>
      )}
      {isFetchingMore && (
        <TableRow>
          <TableCell colSpan={columns.length} className="py-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading more…
            </div>
          </TableCell>
        </TableRow>
      )}
    </TableBody>
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
  /** Called when the user scrolls near the last loaded row */
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

// ─── Shared Table Parts ─────────────────────────────────────────────────────

const containerClassName =
  'view-transition-none flex h-full flex-col overflow-hidden rounded-md border bg-card'

// The overlay scrollbar starts below the sticky header row (h-10).
const scrollbarClassName = 'mt-10'

/**
 * Column widths for the fixed-layout table (and the header-only table the
 * empty state shows).
 */
function DataTableColumnGroup<TData>({
  columns,
}: {
  columns: DataTableColumnDef<TData>[]
}) {
  return (
    <colgroup>
      {columns.map((col) => (
        <col
          key={col.id}
          style={col.width ? { width: col.width } : undefined}
        />
      ))}
    </colgroup>
  )
}

/**
 * Header and rows share one table so screen readers announce each cell with
 * its column. The header cells stick to the top of the scroll area; the inset
 * shadow is their bottom border (collapsed borders don't stick).
 */
function DataTableHead<TData>({
  columns,
}: {
  columns: DataTableColumnDef<TData>[]
}) {
  return (
    <TableHeader className="[&_tr]:border-b-0">
      <TableRow aria-rowindex={1} className="hover:bg-transparent">
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
}

function DataTableLoading<TData>({
  columns,
  className,
}: {
  columns: DataTableColumnDef<TData>[]
  className?: string
}) {
  return (
    <div className={cn(containerClassName, className)}>
      <ScrollArea
        className="min-h-0 flex-1"
        verticalScrollbarClassName={scrollbarClassName}
      >
        <Table className="table-fixed" aria-busy="true">
          <DataTableColumnGroup columns={columns} />
          <DataTableHead columns={columns} />
          <TableBody>
            {Array.from({ length: 10 }).map((_, rowIndex) => (
              <TableRow key={rowIndex} className="h-12">
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

function DataTableEmpty<TData>({
  columns,
  emptyContent,
  error,
  onRetry,
  className,
}: {
  columns: DataTableColumnDef<TData>[]
  emptyContent?: React.ReactNode
  error: unknown
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={cn(containerClassName, 'min-h-0', className)}>
      <div className="shrink-0">
        <Table className="table-fixed">
          <DataTableColumnGroup columns={columns} />
          <DataTableHead columns={columns} />
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

/**
 * Only nearby rows are mounted, so assistive tech gets the full count: rows
 * plus the header row, or -1 while it's unknown and more pages remain.
 */
function getAriaRowCount(
  totalCount: number | null,
  loadedCount: number,
  hasMore: boolean,
) {
  if (totalCount !== null) return totalCount + 1
  return hasMore ? -1 : loadedCount + 1
}

// ─── Data Table ─────────────────────────────────────────────────────────────

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
  // State rather than a ref: the virtualized body needs to re-render once the
  // scroll viewport exists.
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)

  if (isLoading) {
    return <DataTableLoading columns={columns} className={className} />
  }

  if (data.length === 0) {
    return (
      <DataTableEmpty
        columns={columns}
        emptyContent={emptyContent}
        error={error}
        onRetry={onRetry}
        className={className}
      />
    )
  }

  const showEndOfResults = !!onScrollEnd && !hasMore && !isFetchingMore

  return (
    <div className={cn(containerClassName, className)}>
      <ScrollArea
        className="min-h-0 flex-1"
        viewportRef={setViewport}
        viewportClassName={showEndOfResults ? 'flex flex-col' : undefined}
        verticalScrollbarClassName={scrollbarClassName}
      >
        {/* One tooltip serves every truncated cell in the table. */}
        <TruncatedTooltipGroup>
          <Table
            className="table-fixed"
            aria-rowcount={getAriaRowCount(totalCount, data.length, hasMore)}
          >
            <DataTableColumnGroup columns={columns} />
            <DataTableHead columns={columns} />
            <DataTableBody
              scrollElement={viewport}
              columns={columns}
              data={data}
              getRowId={getRowId}
              selectedIds={selectedIds}
              onScrollEnd={onScrollEnd}
              isFetchingMore={isFetchingMore}
              hasMore={hasMore}
            />
          </Table>
        </TruncatedTooltipGroup>
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
