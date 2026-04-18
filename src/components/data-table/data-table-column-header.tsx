import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
} from 'lucide-react'

import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'

interface DataTableColumnHeaderProps extends React.ComponentProps<'div'> {
  title: string
  sortDirection?: 'asc' | 'desc' | false
  onSort?: () => void
}

export function DataTableColumnHeader({
  title,
  sortDirection,
  onSort,
  className,
}: DataTableColumnHeaderProps) {
  if (!onSort) {
    return <div className={cn(className)}>{title}</div>
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={onSort}
      >
        <span>{title}</span>
        {sortDirection === 'desc' ? (
          <ArrowDownIcon data-icon="inline-end" />
        ) : sortDirection === 'asc' ? (
          <ArrowUpIcon data-icon="inline-end" />
        ) : (
          <ArrowUpDownIcon data-icon="inline-end" />
        )}
      </Button>
    </div>
  )
}
