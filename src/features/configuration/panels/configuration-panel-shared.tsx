import type { ReactNode } from 'react'

import { createPortal } from 'react-dom'

import { Save } from 'lucide-react'

import { Badge } from '#/components/ui/badge'

import { Button } from '#/components/ui/button'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#/components/ui/combobox'

import { Spinner } from '#/components/ui/spinner'

import { usePageHeaderActions } from '#/hooks/use-page-header-actions'
import { cn } from '#/lib/utils'

import type { CaseFlowConfiguration } from '#/schemas/configuration.schema'

export type QueueOption = Pick<
  CaseFlowConfiguration['queues'][number],
  'id' | 'name'
> & {
  isActive?: boolean
  lifecycle?: 'draft' | 'active' | 'inactive'
}

export function QueueSelect({
  value,
  queues,
  placeholder,
  onValueChange,
}: {
  value: string
  queues: QueueOption[]
  placeholder: string
  onValueChange: (value: string) => void
}) {
  const selectedQueue = queues.find((queue) => queue.id === value) ?? null
  function isSelectable(queue: QueueOption) {
    if (queue.lifecycle) return queue.lifecycle === 'active'
    return queue.isActive !== false
  }
  return (
    <Combobox
      items={queues}
      value={selectedQueue}
      autoHighlight
      itemToStringLabel={(queue) => queue.name}
      itemToStringValue={(queue) => queue.id}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      onValueChange={(queue) => onValueChange(queue?.id ?? '')}
    >
      <ComboboxInput className="w-full" placeholder={placeholder} showClear />
      <ComboboxContent>
        <ComboboxEmpty>No queues found.</ComboboxEmpty>
        <ComboboxList>
          {(queue: QueueOption) => (
            <ComboboxItem
              key={queue.id}
              value={queue}
              disabled={!isSelectable(queue)}
            >
              <span className="min-w-0 flex-1 truncate">{queue.name}</span>
              {!isSelectable(queue) ? (
                <Badge variant="outline">{queue.lifecycle ?? 'Inactive'}</Badge>
              ) : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function ConfigurationHeaderActions({
  children,
}: {
  children: ReactNode
}) {
  const target = usePageHeaderActions()
  if (!target) return null
  return createPortal(children, target)
}

export function ConfigurationSaveButton({
  dirty,
  isPending,
  disabled = false,
  onClick,
  label = 'Save changes',
}: {
  dirty: boolean
  isPending: boolean
  disabled?: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <>
      {dirty && !isPending ? (
        <span className="text-sm text-muted-foreground">Unsaved changes</span>
      ) : null}
      <Button
        size="sm"
        onClick={onClick}
        disabled={!dirty || isPending || disabled}
      >
        {isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Save data-icon="inline-start" />
        )}
        {label}
      </Button>
    </>
  )
}

export function ConfigurationPanel({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'divide-y rounded-xl border bg-card text-card-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ConfigurationSection({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="grid gap-4 p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}
