import type { ComponentType, ReactNode, SVGProps } from 'react'
import { FilterX, SearchX } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

// Shared empty state for tables, panels, and feeds. Keep copy pattern:
// a short title ("No merchants yet.") + an optional hint that tells the
// user what to do next, plus an optional action.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description?: string
  action?: ReactNode
  /** 'success' for inbox-zero states ("all caught up", "nothing pending"). */
  tone?: 'neutral' | 'success'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1 py-10 text-center',
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            'mb-2 flex size-10 items-center justify-center rounded-full',
            tone === 'success'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

// A list that is empty only because of the user's search or filters: name
// the search when there is one, and offer the way back to the full list.
export function FilteredEmptyState({
  noun,
  search,
  hasOtherFilters,
  onClearFilters,
}: {
  /** Plural, lowercase: "merchants". */
  noun: string
  search?: string
  hasOtherFilters: boolean
  onClearFilters: () => void
}) {
  return (
    <EmptyState
      icon={SearchX}
      title={
        search
          ? `No ${noun} match "${search}".`
          : `No ${noun} match your filters.`
      }
      description={
        search && hasOtherFilters ? 'Other filters also apply.' : undefined
      }
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearFilters}
        >
          <FilterX data-icon="inline-start" />
          Clear filters
        </Button>
      }
    />
  )
}
