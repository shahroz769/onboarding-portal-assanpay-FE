import { useRef, useState } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'

function isTextTruncated(element: HTMLElement | null) {
  if (!element) return false
  const nodes = [element, ...element.querySelectorAll<HTMLElement>('*')]
  return nodes.some((node) => node.scrollWidth > node.clientWidth)
}

type TruncatedTooltipProps = {
  /** Element that truncates (or contains truncating children), e.g. `<span className="truncate" />` */
  render: React.ComponentProps<typeof TooltipTrigger>['render']
  children: React.ReactNode
  /** Full text shown in the tooltip */
  content: React.ReactNode
  contentClassName?: string
  side?: React.ComponentProps<typeof TooltipContent>['side']
}

/**
 * Tooltip that only opens when the trigger's text is cut off, so fully
 * visible names don't repeat themselves on hover.
 */
export function TruncatedTooltip({
  render,
  children,
  content,
  contentClassName = 'max-w-xs',
  side,
}: TruncatedTooltipProps) {
  const triggerRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)

  return (
    <Tooltip
      open={open}
      onOpenChange={(nextOpen) =>
        setOpen(nextOpen && isTextTruncated(triggerRef.current))
      }
    >
      <TooltipTrigger
        ref={(node: HTMLElement | null) => {
          triggerRef.current = node
        }}
        render={render}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={contentClassName}>
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
