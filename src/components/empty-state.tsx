import type { ComponentType, ReactNode, SVGProps } from 'react'

import { cn } from '#/lib/utils'

// Shared empty state for tables, panels, and feeds. Keep copy pattern:
// a short title ("No merchants found.") + an optional hint that tells the
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
