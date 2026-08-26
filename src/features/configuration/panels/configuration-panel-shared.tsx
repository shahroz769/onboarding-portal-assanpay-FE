import type { ComponentType, ReactNode, SVGProps } from 'react'

import { useState } from 'react'

import { Plus, Save, Trash2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'

import { Badge } from '#/components/ui/badge'

import { Button } from '#/components/ui/button'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#/components/ui/combobox'

import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

import { Spinner } from '#/components/ui/spinner'

import { MethodListSkeleton } from '../configuration-route-skeleton'

import { SectionIcon } from '#/components/section-icon'
import type { StatusTint } from '#/lib/status-styles'
import { getApiErrorMessage } from '#/lib/get-api-error-message'

import type {
  CaseFlowConfiguration,
  PayoutMethodSettings,
} from '#/schemas/configuration.schema'

import { getValidationErrors } from './configuration-panel-utils'

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

type MethodSettings = PayoutMethodSettings

export function MethodListPanel<T extends MethodSettings>({
  data,
  isPending,
  queryError,
  mutation,
  icon,
  tone,
  title,
  description,
  addLabel,
  saveLabel,
  emptyMessage,
  schema,
  createMethod,
  renderMethodDetails,
  methodNameLabel = 'Method name',
}: {
  data: T | null
  isPending: boolean
  queryError?: unknown
  mutation: {
    isPending: boolean
    mutate: (value: T) => void
  }
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  title: string
  description: string
  addLabel: string
  saveLabel: string
  emptyMessage: string
  schema: {
    safeParse: (value: unknown) =>
      | { success: true }
      | {
          success: false
          error: { issues: Array<{ path: PropertyKey[]; message: string }> }
        }
  }
  createMethod: (id: string) => T[number]
  methodNameLabel?: string
  renderMethodDetails?: (input: {
    method: T[number]
    index: number
    disabled: boolean
    update: (method: T[number]) => void
  }) => ReactNode
}) {
  const [form, setForm] = useState<T | null>(null)
  const [enteringMethodIds, setEnteringMethodIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [removingMethodIds, setRemovingMethodIds] = useState<Set<string>>(
    () => new Set(),
  )
  const value = form ?? data ?? null
  const validationErrors = value
    ? getValidationErrors(schema.safeParse(value))
    : {}
  const formError = Object.values(validationErrors)[0]
  function updateMethod(id: string, label: string) {
    setForm(
      (current) =>
        (current ?? data ?? []).map((method) =>
          method.id === id ? { ...method, label } : method,
        ) as T,
    )
  }
  function replaceMethod(method: T[number]) {
    setForm(
      (current) =>
        (current ?? data ?? []).map((item) =>
          item.id === method.id ? method : item,
        ) as T,
    )
  }
  function addMethod() {
    const id = createMethodId()
    setForm((current) => [...(current ?? data ?? []), createMethod(id)] as T)
    setEnteringMethodIds((current) => new Set(current).add(id))
  }
  function removeMethod(id: string) {
    setRemovingMethodIds((current) => new Set(current).add(id))
  }
  function finishMethodTransition(
    id: string,
    event: React.TransitionEvent<HTMLDivElement>,
  ) {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== 'opacity'
    ) {
      return
    }

    if (removingMethodIds.has(id)) {
      setForm(
        (current) =>
          (current ?? data ?? []).filter((method) => method.id !== id) as T,
      )
      setRemovingMethodIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      setEnteringMethodIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      return
    }

    if (enteringMethodIds.has(id)) {
      setEnteringMethodIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }
  if (queryError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{title} could not be loaded</AlertTitle>
        <AlertDescription>
          {getApiErrorMessage(
            queryError,
            `Failed to load ${title.toLowerCase()}.`,
          )}
        </AlertDescription>
      </Alert>
    )
  }
  if (isPending || !value) {
    return <MethodListSkeleton />
  }
  return (
    <div className="flex flex-col gap-6">
      <ConfigurationSectionCard
        icon={icon}
        tone={tone}
        title={title}
        description={description}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={addMethod}
            disabled={mutation.isPending || removingMethodIds.size > 0}
          >
            <Plus data-icon="inline-start" />
            {addLabel}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {value.length > 0 ? (
            <div className="flex flex-col gap-2">
              {value.map((method, index) => (
                <div
                  key={method.id}
                  data-motion={
                    removingMethodIds.has(method.id)
                      ? 'exiting'
                      : enteringMethodIds.has(method.id)
                        ? 'entering'
                        : undefined
                  }
                  className="motion-list-item grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto]"
                  onTransitionEnd={(event) =>
                    finishMethodTransition(method.id, event)
                  }
                >
                  <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <div className="grid gap-1">
                    <Label htmlFor={`method-name-${method.id}`}>
                      {methodNameLabel}
                    </Label>
                    <Input
                      id={`method-name-${method.id}`}
                      value={method.label}
                      onChange={(event) =>
                        updateMethod(method.id, event.target.value)
                      }
                      disabled={
                        mutation.isPending || removingMethodIds.has(method.id)
                      }
                      placeholder={`Enter ${methodNameLabel.toLowerCase()}`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeMethod(method.id)}
                    disabled={
                      mutation.isPending || removingMethodIds.has(method.id)
                    }
                    aria-label={`Remove method ${index + 1}`}
                  >
                    <Trash2 />
                  </Button>
                  {renderMethodDetails ? (
                    <div className="sm:col-start-2 sm:col-end-4">
                      {renderMethodDetails({
                        method,
                        index,
                        disabled:
                          mutation.isPending ||
                          removingMethodIds.has(method.id),
                        update: replaceMethod,
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-md border border-dashed py-8 text-center">
              <p className="text-sm font-medium">{emptyMessage}</p>
              <p className="text-xs text-muted-foreground">
                Click &ldquo;{addLabel}&rdquo; to create one.
              </p>
            </div>
          )}
          {formError ? (
            <Alert variant="destructive">
              <AlertTitle>Payment method details need attention</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </ConfigurationSectionCard>

      <ConfigurationActionBar>
        <Button
          onClick={() =>
            mutation.mutate(
              value.flatMap((method) => {
                const label = method.label.trim()
                return label ? [{ ...method, label }] : []
              }) as T,
            )
          }
          disabled={
            mutation.isPending ||
            removingMethodIds.size > 0 ||
            Boolean(formError)
          }
        >
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {saveLabel}
        </Button>
      </ConfigurationActionBar>
    </div>
  )
}

function createMethodId() {
  return crypto.randomUUID()
}

export function ConfigurationSectionCard({
  icon,
  tone,
  title,
  description,
  action,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <ConfigurationCardHeaderContent
          icon={icon}
          tone={tone}
          title={title}
          description={description}
        />
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function ConfigurationActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border-t bg-background/90 py-4 backdrop-blur-sm">
      {children}
    </div>
  )
}

function ConfigurationCardHeaderContent({
  icon,
  tone,
  title,
  description,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  title: string
  description: string
}) {
  return (
    <div className="flex items-center gap-3">
      <SectionIcon icon={icon} tone={tone} />
      <div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
    </div>
  )
}
