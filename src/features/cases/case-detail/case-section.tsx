import type { ComponentType, ReactNode, SVGProps } from 'react'

import { CardDescription, CardTitle } from '#/components/ui/card'
import { SectionIcon } from '#/components/section-icon'
import type { StatusTint } from '#/lib/status-styles'

/**
 * Card heading for case-detail workflow panels, matching Documents Review:
 * a tinted icon chip, the title and a one-line description, with optional
 * right-aligned content (a status badge, a button). Goes inside CardHeader.
 */
export function CaseCardHeading({
  icon,
  tone,
  title,
  description,
  action,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone: StatusTint
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SectionIcon icon={icon} tone={tone} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  )
}
