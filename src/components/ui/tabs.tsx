import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'

import { cn } from '#/lib/utils'

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col',
        className,
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  'group/tabs-list relative inline-flex w-fit items-center justify-center rounded-lg p-0.75 text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
      <TabsIndicator />
    </TabsPrimitive.List>
  )
}

// Slides between tabs instead of the active background jumping. Positioned
// with `translate` from Base UI's measured --active-tab-* vars.
function TabsIndicator() {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      renderBeforeHydration
      className={cn(
        'pointer-events-none absolute top-0 left-0 z-0 transition-[translate,width,height] duration-250 ease-in-out motion-reduce:transition-none',
        // default: the raised active "pill"
        'group-data-[variant=default]/tabs-list:h-(--active-tab-height) group-data-[variant=default]/tabs-list:w-(--active-tab-width) group-data-[variant=default]/tabs-list:translate-x-(--active-tab-left) group-data-[variant=default]/tabs-list:translate-y-(--active-tab-top) group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:border group-data-[variant=default]/tabs-list:border-transparent group-data-[variant=default]/tabs-list:bg-background group-data-[variant=default]/tabs-list:shadow-sm dark:group-data-[variant=default]/tabs-list:border-foreground/10',
        // line, horizontal: underline below the active tab
        'group-data-[variant=line]/tabs-list:bg-foreground group-data-[orientation=horizontal]/tabs:group-data-[variant=line]/tabs-list:h-0.5 group-data-[orientation=horizontal]/tabs:group-data-[variant=line]/tabs-list:w-(--active-tab-width) group-data-[orientation=horizontal]/tabs:group-data-[variant=line]/tabs-list:translate-x-(--active-tab-left) group-data-[orientation=horizontal]/tabs:group-data-[variant=line]/tabs-list:translate-y-[calc(var(--active-tab-top)+var(--active-tab-height)+(--spacing(1.25))-2px)]',
        // line, vertical: bar to the right of the active tab
        'group-data-[orientation=vertical]/tabs:group-data-[variant=line]/tabs-list:h-(--active-tab-height) group-data-[orientation=vertical]/tabs:group-data-[variant=line]/tabs-list:w-0.5 group-data-[orientation=vertical]/tabs:group-data-[variant=line]/tabs-list:translate-x-[calc(var(--active-tab-left)+var(--active-tab-width)+(--spacing(1))-2px)] group-data-[orientation=vertical]/tabs:group-data-[variant=line]/tabs-list:translate-y-(--active-tab-top)',
      )}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // The active background/underline is drawn by TabsIndicator; triggers
        // sit above it and only transition their text color.
        "relative z-1 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors duration-200 ease-in-out group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring data-disabled:pointer-events-none data-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'data-active:text-foreground dark:data-active:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
