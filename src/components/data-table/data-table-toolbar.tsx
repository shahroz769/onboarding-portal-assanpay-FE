import type { ReactNode } from 'react'

interface DataTableToolbarProps {
  children: ReactNode
}

export function DataTableToolbar({ children }: DataTableToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {children}
    </div>
  )
}

function DataTableToolbarFilters({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
}

function DataTableToolbarActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>
}

DataTableToolbar.Filters = DataTableToolbarFilters
DataTableToolbar.Actions = DataTableToolbarActions
