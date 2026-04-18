import type { Table } from '@tanstack/react-table'

interface DataTableSelectionInfoProps<TData> {
  table: Table<TData>
  children?: React.ReactNode
}

export function DataTableSelectionInfo<TData>({
  table,
  children,
}: DataTableSelectionInfoProps<TData>) {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const visibleCount = table.getFilteredRowModel().rows.length

  if (selectedCount === 0) return null

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
      <div className="text-sm text-muted-foreground">
        {selectedCount} of {visibleCount} row(s) selected
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
