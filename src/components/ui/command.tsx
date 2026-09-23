import * as React from 'react'
import { Combobox as CommandPrimitive } from '@base-ui/react/combobox'
import { SearchIcon } from 'lucide-react'

import { cn } from '#/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'

const CommandContext = React.createContext({ query: '', shouldFilter: true })

function Command({
  className,
  items = [],
  shouldFilter = true,
  inputValue,
  onInputValueChange,
  ...props
}: React.ComponentProps<'div'> & {
  items?: string[]
  shouldFilter?: boolean
  inputValue?: string
  onInputValueChange?: (value: string) => void
}) {
  const [internalQuery, setInternalQuery] = React.useState('')
  const query = inputValue ?? internalQuery

  return (
    <CommandContext.Provider value={{ query, shouldFilter }}>
      <CommandPrimitive.Root<string>
        inline
        open
        items={items}
        inputValue={query}
        onInputValueChange={(value) => {
          setInternalQuery(value)
          onInputValueChange?.(value)
        }}
        filter={
          shouldFilter
            ? (item, text) => item.toLowerCase().includes(text.toLowerCase())
            : null
        }
      >
        <div
          data-slot="command"
          className={cn(
            'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
            className,
          )}
          {...props}
        />
      </CommandPrimitive.Root>
    </CommandContext.Provider>
  )
}

function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = true,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, 'children'> & {
  children?: React.ReactNode
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn('overflow-hidden p-0', className)}
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command className="**:data-[slot=command-input-wrapper]:h-12 [&_[data-slot=command-group-label]]:px-2 [&_[data-slot=command-group-label]]:font-medium [&_[data-slot=command-group-label]]:text-muted-foreground [&_[data-slot=command-group]]:px-2 [&_[data-slot=command-input-wrapper]_svg]:size-5 [&_[data-slot=command-input]]:h-12 [&_[data-slot=command-item]]:px-2 [&_[data-slot=command-item]]:py-3 [&_[data-slot=command-item]_svg]:size-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-9 items-center gap-2 border-b px-3"
    >
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto',
        className,
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn('py-6 text-center text-sm', className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group> & {
  heading?: React.ReactNode
}) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn('overflow-hidden p-1 text-foreground', className)}
      {...props}
    >
      {heading && (
        <CommandPrimitive.GroupLabel
          data-slot="command-group-label"
          className="px-2 py-1.5 text-xs font-medium text-muted-foreground"
        >
          {heading}
        </CommandPrimitive.GroupLabel>
      )}
      {children}
    </CommandPrimitive.Group>
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('-mx-1 h-px bg-border', className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  onSelect,
  onClick,
  value,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item> & {
  onSelect?: (value: string) => void
}) {
  const { query, shouldFilter } = React.useContext(CommandContext)
  if (
    shouldFilter &&
    query &&
    !String(value ?? '')
      .toLowerCase()
      .includes(query.toLowerCase())
  ) {
    return null
  }

  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      value={value}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onSelect?.(String(value ?? ''))
      }}
      {...props}
    />
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        'ml-auto text-xs tracking-widest text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
