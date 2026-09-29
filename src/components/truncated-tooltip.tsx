import { useLayoutEffect, useRef, useState } from 'react'

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
  /**
   * For a trigger with no focusable element inside: joins the tab order while
   * its text is cut off, so keyboard users can reach the full value.
   */
  focusable?: boolean
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
  focusable = false,
}: TruncatedTooltipProps) {
  const triggerRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)

  // Measured once on mount: table columns have fixed widths.
  useLayoutEffect(() => {
    if (focusable) setIsTruncated(isTextTruncated(triggerRef.current))
  }, [focusable])

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
        tabIndex={focusable && isTruncated ? 0 : undefined}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={contentClassName}>
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
