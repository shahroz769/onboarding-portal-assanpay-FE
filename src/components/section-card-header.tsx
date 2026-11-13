import type { ComponentType, ReactNode, SVGProps } from 'react'

import { SectionIcon } from '#/components/section-icon'
import { CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import type { StatusTint } from '#/lib/status-styles'

/** Card header with an icon chip and an h2 title, used by the merchant tabs. */
export function SectionCardHeader({
  icon,
  tone,
  title,
  description,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  title: string
  description: ReactNode
}) {
  return (
    <CardHeader>
      <div className="flex items-center gap-3">
        <SectionIcon icon={icon} tone={tone} />
        <div>
          <CardTitle render={<h2 />}>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  )
}
