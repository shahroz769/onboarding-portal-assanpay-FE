import * as React from 'react'
import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'

import { cn } from '#/lib/utils'

function ScrollArea({
  className,
  children,
  viewportRef,
  viewportClassName,
  verticalScrollbarClassName,
  onScroll,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewportRef?: React.Ref<HTMLDivElement>
  viewportClassName?: string
  /** E.g. a top margin that keeps the scrollbar off a sticky header. */
  verticalScrollbarClassName?: string
  onScroll?: React.UIEventHandler<HTMLDivElement>
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        onScroll={onScroll}
        className={cn(
          'size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1',
          viewportClassName,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar className={verticalScrollbarClassName} />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      // Overlay scrollbar: hidden until the area is hovered or scrolled, so a
      // list that overflows by a few pixels doesn't show a near-full-height
      // thumb over its items. Base UI positions it absolutely along the edge;
      // the margins keep it off the popup's rounded corners.
      className={cn(
        'flex touch-none p-0.5 opacity-0 transition-opacity duration-150 select-none data-hovering:opacity-100 data-scrolling:opacity-100',
        orientation === 'vertical' && 'my-1 w-2',
        orientation === 'horizontal' && 'mx-1 h-2 flex-col',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border transition-colors hover:bg-muted-foreground/40"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
