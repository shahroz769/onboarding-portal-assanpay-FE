import { useEffect, useRef } from 'react'

import { cn } from '#/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Spinner } from '#/components/ui/spinner'

// ─── Column Definition ──────────────────────────────────────────────────────

export interface DataTableColumnDef<TData> {
  id: string
  header: React.ReactNode
  cell: (item: TData) => React.ReactNode
  width?: number
}

// ─── Props ──────────────────────────────────────────────────────────────────

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
  /** Called when the scroll sentinel becomes visible */
  onScrollEnd?: () => void
  /** Whether more data is currently being fetched */
  isFetchingMore?: boolean
  /** Whether there are more pages to fetch */
  hasMore?: boolean
}

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  selectedIds,
  isLoading = false,
  emptyContent,
  onScrollEnd,
  isFetchingMore = false,
  hasMore = false,
}: DataTableProps<TData>) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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
        root: scrollContainerRef.current,
        rootMargin: '200px',
      },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [onScrollEnd, hasMore, isFetchingMore])

  const headerRow = (
    <TableRow>
      {columns.map((col) => (
        <TableHead key={col.id} style={col.width ? { width: col.width } : undefined}>
          {col.header}
        </TableHead>
      ))}
    </TableRow>
  )

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border">
        <Table className="table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
            {headerRow}
          </TableHeader>
        </Table>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/20">
          <div className="flex flex-col items-center gap-3 text-center">
            <Spinner className="size-7 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Loading merchants</p>
              <p className="text-xs text-muted-foreground">
                Fetching the latest onboarding records...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-auto rounded-md border will-change-transform"
    >
      <Table className="table-fixed">
        <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
          {headerRow}
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center">
                {emptyContent ?? (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <p className="text-sm">No results found.</p>
                    <p className="text-xs">Try adjusting your search or filters.</p>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => {
              const rowId = getRowId(item)
              const isSelected = selectedIds?.has(rowId) ?? false
              return (
                <TableRow
                  key={rowId}
                  data-state={isSelected ? 'selected' : undefined}
                  className={cn(
                    'content-visibility-auto contain-intrinsic-size-auto-48px',
                    isSelected && 'bg-muted/50',
                  )}
                >
                  {columns.map((col) => (
                    <TableCell key={col.id}>
                      {col.cell(item)}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          )}
          {isFetchingMore && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-4 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  Loading more...
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {onScrollEnd && <div ref={sentinelRef} className="h-px" />}
    </div>
  )
}
