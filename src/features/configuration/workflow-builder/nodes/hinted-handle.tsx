import { Handle, Position } from '@xyflow/react'
import type { HandleProps } from '@xyflow/react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'

type HintedHandleProps = HandleProps & {
  className?: string
  style?: React.CSSProperties
  hint: string
}

/** A React Flow handle that explains itself with a tooltip on hover. */
export function HintedHandle({ hint, ...handleProps }: HintedHandleProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Handle {...handleProps} />} />
      <TooltipContent
        side={handleProps.position === Position.Left ? 'left' : 'right'}
        className="max-w-60"
      >
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}
