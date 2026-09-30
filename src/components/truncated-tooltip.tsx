import { createContext, use, useEffect, useRef, useState } from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'

function isTextTruncated(element: Element | null | undefined) {
  if (!element) return false
  const nodes = [element, ...element.querySelectorAll('*')]
  return nodes.some((node) => node.scrollWidth > node.clientWidth)
}

type TooltipSide = React.ComponentProps<typeof TooltipContent>['side']

type SharedTooltipPayload = {
  content: React.ReactNode
  contentClassName: string
  side: TooltipSide
}

const SharedTooltipHandleContext =
  createContext<TooltipPrimitive.Handle<SharedTooltipPayload> | null>(null)

/**
 * One tooltip for every `TruncatedTooltip` inside it. Long lists (table rows)
 * then mount a trigger per cell instead of a whole tooltip each; the active
 * trigger passes its content along as the payload.
 */
export function TruncatedTooltipGroup({
  children,
}: {
  children: React.ReactNode
}) {
  const [handle] = useState(() =>
    TooltipPrimitive.createHandle<SharedTooltipPayload>(),
  )

  return (
    <SharedTooltipHandleContext value={handle}>
      {children}
      <TooltipPrimitive.Root
        data-slot="tooltip"
        handle={handle}
        onOpenChange={(open, eventDetails) => {
          if (open && !isTextTruncated(eventDetails.trigger)) {
            eventDetails.cancel()
          }
        }}
      >
        {({ payload }) =>
          payload ? (
            <TooltipContent
              side={payload.side}
              className={payload.contentClassName}
            >
              {payload.content}
            </TooltipContent>
          ) : null
        }
      </TooltipPrimitive.Root>
    </SharedTooltipHandleContext>
  )
}

type TruncatedTooltipProps = {
  /** Element that truncates (or contains truncating children), e.g. `<span className="truncate" />` */
  render: React.ComponentProps<typeof TooltipTrigger>['render']
  children: React.ReactNode
  /** Full text shown in the tooltip */
  content: React.ReactNode
  contentClassName?: string
  side?: TooltipSide
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
  const sharedHandle = use(SharedTooltipHandleContext)
  const triggerRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)

  // Measured once on mount: table columns have fixed widths. After paint, so
  // rows mounting mid-scroll share one layout read instead of each blocking
  // the frame.
  useEffect(() => {
    if (focusable) setIsTruncated(isTextTruncated(triggerRef.current))
  }, [focusable])

  const setTriggerRef = (node: HTMLElement | null) => {
    triggerRef.current = node
  }
  const tabIndex = focusable && isTruncated ? 0 : undefined

  if (sharedHandle) {
    return (
      <TooltipPrimitive.Trigger
        data-slot="tooltip-trigger"
        ref={setTriggerRef}
        handle={sharedHandle}
        payload={{ content, contentClassName, side }}
        render={render}
        tabIndex={tabIndex}
      >
        {children}
      </TooltipPrimitive.Trigger>
    )
  }

  return (
    <Tooltip
      open={open}
      onOpenChange={(nextOpen) =>
        setOpen(nextOpen && isTextTruncated(triggerRef.current))
      }
    >
      <TooltipTrigger ref={setTriggerRef} render={render} tabIndex={tabIndex}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={contentClassName}>
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
