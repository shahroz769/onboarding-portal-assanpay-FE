import { useCallback, useEffect, useRef } from 'react'
import type { Table as TanstackTable } from '@tanstack/react-table'
import { flexRender } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

import { cn } from '#/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Skeleton } from '#/components/ui/skeleton'

interface DataTableProps<TData> {
  table: TanstackTable<TData>
  /** Columns count for empty/loading states */
  columnCount: number
  /** Infinite scroll: load more callback */
  onLoadMore?: () => void
  /** Whether more data is being loaded */
  isFetchingNextPage?: boolean
  /** Whether there's more data to load */
  hasNextPage?: boolean
  /** Whether initial data is loading */
  isLoading?: boolean
  /** Estimated row height for virtualizer */
  estimateSize?: number
  /** Empty state content */
  emptyContent?: React.ReactNode
}

export function DataTable<TData>({
  table,
  columnCount,
  onLoadMore,
  isFetchingNextPage = false,
  hasNextPage = false,
  isLoading = false,
  estimateSize = 48,
  emptyContent,
}: DataTableProps<TData>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 10,
  })

  // Infinite scroll: trigger onLoadMore when near bottom
  const handleScroll = useCallback(() => {
    const el = parentRef.current
    if (!el || !onLoadMore || !hasNextPage || isFetchingNextPage) return

    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 300) {
      onLoadMore()
    }
  }, [onLoadMore, hasNextPage, isFetchingNextPage])

  useEffect(() => {
    const el = parentRef.current
    if (!el) return

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columnCount }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="overflow-auto rounded-md border"
      style={{ maxHeight: 'calc(100vh - 280px)' }}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-32 text-center">
                {emptyContent ?? (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <p className="text-sm">No results found.</p>
                    <p className="text-xs">Try adjusting your search or filters.</p>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ) : (
            <>
              {virtualizer.getVirtualItems().length > 0 && (
                <tr>
                  <td
                    colSpan={columnCount}
                    style={{ height: virtualizer.getVirtualItems()[0]?.start ?? 0 }}
                  />
                </tr>
              )}
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index]
                if (!row) return null
                return (
                  <TableRow
                    key={row.id}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className={cn(
                      row.getIsSelected() && 'bg-muted/50',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
              {virtualizer.getVirtualItems().length > 0 && (
                <tr>
                  <td
                    colSpan={columnCount}
                    style={{
                      height:
                        virtualizer.getTotalSize() -
                        (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                    }}
                  />
                </tr>
              )}
            </>
          )}
          {isFetchingNextPage && (
            <TableRow>
              {Array.from({ length: columnCount }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
