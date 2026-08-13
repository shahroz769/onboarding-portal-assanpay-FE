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

import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'

import { Input } from '#/components/ui/input'

import { Separator } from '#/components/ui/separator'

import { Spinner } from '#/components/ui/spinner'

import { ConfigurationPanelSkeleton } from '../configuration-route-skeleton'

import { cn } from '#/lib/utils'

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
  colorClass,
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
  colorClass: string
  title: string
  description: string
  addLabel: string
  saveLabel: string
  emptyMessage: string
}) {
  const [form, setForm] = useState<PaymentMethodSettings | null>(null)
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
    setForm((current) => [
      ...(current ?? data ?? []),
      { id: createMethodId(), label: '' },
    ])
  }
  function removeMethod(id: string) {
    setForm((current) =>
      (current ?? data ?? []).filter((method) => method.id !== id),
    )
  }
  if (isPending || !value) {
    return <PanelLoading />
  }
  return (
    <div className="flex flex-col gap-6">
      <ConfigurationSectionCard
        icon={icon}
        colorClass={colorClass}
        title={title}
        description={description}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={addMethod}
            disabled={mutation.isPending}
          >
            <Plus data-icon="inline-start" />
            {addLabel}
          </Button>
        }
      >
        <FieldGroup>
          {value.length > 0 ? (
            value.map((method, index) => (
              <Field key={method.id}>
                <FieldLabel htmlFor={`${method.id}-label`}>
                  Method {index + 1}
                </FieldLabel>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    id={`${method.id}-label`}
                    value={method.label}
                    onChange={(event) =>
                      updateMethod(method.id, event.target.value)
                    }
                    disabled={mutation.isPending}
                    placeholder="Method name"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeMethod(method.id)}
                    disabled={mutation.isPending}
                    aria-label="Remove method"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </Field>
            ))
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
          {formError ? (
            <Alert variant="destructive">
              <AlertTitle>Method names need attention</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
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
          disabled={mutation.isPending || Boolean(formError)}
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
  colorClass,
  title,
  description,
  action,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
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
          colorClass={colorClass}
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
    <div className="flex flex-col gap-4">
      <Separator />
      <div className="flex justify-end">{children}</div>
    </div>
  )
}

function ConfigurationCardHeaderContent({
  icon,
  colorClass,
  title,
  description,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
  title: string
  description: string
}) {
  const Icon = icon
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-lg',
          colorClass,
        )}
      >
        <Icon className="size-5" />
      </div>
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
