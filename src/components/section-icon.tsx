import type { ComponentType, SVGProps } from 'react'

import { statusTint } from '#/lib/status-styles'
import type { StatusTint } from '#/lib/status-styles'
import { cn } from '#/lib/utils'

// Standardized section-header icon chip. Tones come from the shared tint
// map in status-styles so chips and status badges never drift apart.
export function SectionIcon({
  icon: Icon,
  tone = 'neutral',
  className,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        statusTint(tone),
        className,
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </div>
  )
}
