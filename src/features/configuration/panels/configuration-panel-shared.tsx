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

import { Spinner } from '#/components/ui/spinner'

import { ConfigurationPanelSkeleton } from '../configuration-route-skeleton'

import { SectionIcon } from '#/components/section-icon'
import type { StatusTint } from '#/lib/status-styles'

import type {
  CaseFlowConfiguration,
  PaymentMethodSettings,
} from '#/schemas/configuration.schema'

import { paymentMethodSettingsSchema } from '#/schemas/configuration.schema'
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

export function MethodListPanel({
  data,
  isPending,
  mutation,
  icon,
  tone,
  title,
  description,
  addLabel,
  saveLabel,
  emptyMessage,
}: {
  data: PaymentMethodSettings | null
  isPending: boolean
  mutation: {
    isPending: boolean
    mutate: (value: PaymentMethodSettings) => void
  }
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  title: string
  description: string
  addLabel: string
  saveLabel: string
  emptyMessage: string
}) {
  const [form, setForm] = useState<PaymentMethodSettings | null>(null)
  const [enteringMethodIds, setEnteringMethodIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [removingMethodIds, setRemovingMethodIds] = useState<Set<string>>(
    () => new Set(),
  )
  const value = form ?? data ?? null
  const validationErrors = value
    ? getValidationErrors(paymentMethodSettingsSchema.safeParse(value))
    : {}
  const formError = validationErrors.paymentMethods
  function updateMethod(id: string, label: string) {
    setForm((current) =>
      (current ?? data ?? []).map((method) =>
        method.id === id ? { ...method, label } : method,
      ),
    )
  }
  function addMethod() {
    const id = createMethodId()
    setForm((current) => [...(current ?? data ?? []), { id, label: '' }])
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
      setForm((current) =>
        (current ?? data ?? []).filter((method) => method.id !== id),
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
  if (isPending || !value) {
    return <PanelLoading />
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
                  className="motion-list-item flex items-center gap-2"
                  onTransitionEnd={(event) =>
                    finishMethodTransition(method.id, event)
                  }
                >
                  <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <Input
                    value={method.label}
                    aria-label={`Method ${index + 1} name`}
                    onChange={(event) =>
                      updateMethod(method.id, event.target.value)
                    }
                    disabled={
                      mutation.isPending || removingMethodIds.has(method.id)
                    }
                    placeholder="Method name"
                  />
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
              <AlertTitle>Method names need attention</AlertTitle>
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
              }),
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

export function PanelLoading() {
  return <ConfigurationPanelSkeleton />
}
