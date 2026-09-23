import { useState } from 'react'

import type { ComponentType, SVGProps } from 'react'

import { Pencil, Plus, Trash2 } from 'lucide-react'

import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
import { EmptyState } from '#/components/empty-state'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'

import { Button } from '#/components/ui/button'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '#/components/ui/field'

import { Input } from '#/components/ui/input'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '#/components/ui/input-group'

import { Spinner } from '#/components/ui/spinner'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'

import { getApiErrorMessage } from '#/lib/get-api-error-message'

import type { PaymentMethod } from '#/schemas/configuration.schema'

import { MethodListSkeleton } from '../configuration-route-skeleton'

import { ConfigurationHeaderActions } from './configuration-panel-shared'
import { getValidationErrors } from './configuration-panel-utils'

type MethodMutation = {
  isPending: boolean
  mutate: (value: PaymentMethod[], options?: { onSuccess?: () => void }) => void
}

type MethodDraft = {
  label: string
  commissionRate: string
  testingMin: string
  testingMax: string
  liveMin: string
  liveMax: string
}

type DraftErrors = Partial<Record<keyof MethodDraft | 'form', string>>

const emptyDraft: MethodDraft = {
  label: '',
  commissionRate: '',
  testingMin: '',
  testingMax: '',
  liveMin: '',
  liveMax: '',
}

export function MethodListPanel({
  data,
  isPending,
  queryError,
  mutation,
  icon,
  noun,
  title,
  schema,
}: {
  data: PaymentMethod[] | null
  isPending: boolean
  queryError?: unknown
  mutation: MethodMutation
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Singular, lowercase, e.g. "payment method". */
  noun: string
  title: string
  schema: {
    safeParse: (value: unknown) =>
      | { success: true }
      | {
          success: false
          error: { issues: Array<{ path: PropertyKey[]; message: string }> }
        }
  }
}) {
  const [editor, setEditor] = useState<
    { mode: 'create' } | { mode: 'edit'; method: PaymentMethod } | null
  >(null)
  const [pendingRemoval, setPendingRemoval] = useState<PaymentMethod | null>(
    null,
  )
  const methods = data ?? []

  const columns: DataTableColumnDef<PaymentMethod>[] = [
    {
      id: 'label',
      header: 'Method',
      width: 260,
      cell: (method) => (
        <span className="truncate font-medium">{method.label}</span>
      ),
    },
    {
      id: 'commissionRate',
      header: <span className="block text-right">Commission</span>,
      width: 130,
      cell: (method) => (
        <span className="block text-right font-medium tabular-nums">
          {formatRate(method.commissionRate)}
        </span>
      ),
    },
    {
      id: 'testing',
      header: <span className="block text-right">Testing limit</span>,
      width: 220,
      cell: (method) => (
        <LimitRange min={method.testing.min} max={method.testing.max} />
      ),
    },
    {
      id: 'live',
      header: <span className="block text-right">Live limit</span>,
      width: 220,
      cell: (method) => (
        <LimitRange min={method.live.min} max={method.live.max} />
      ),
    },
    {
      id: 'actions',
      header: <span className="block text-right">Actions</span>,
      width: 110,
      cell: (method) => (
        <div className="flex justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={mutation.isPending}
                onClick={() => setEditor({ mode: 'edit', method })}
              >
                <Pencil />
                <span className="sr-only">Edit {method.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={mutation.isPending}
                onClick={() => setPendingRemoval(method)}
              >
                <Trash2 />
                <span className="sr-only">Remove {method.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]

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

  if (isPending || !data) {
    return <MethodListSkeleton />
  }

  function removeMethod(method: PaymentMethod) {
    mutation.mutate(
      methods.filter((item) => item.id !== method.id),
      { onSuccess: () => setPendingRemoval(null) },
    )
  }

  return (
    <>
      <ConfigurationHeaderActions>
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={() => setEditor({ mode: 'create' })}
        >
          <Plus data-icon="inline-start" />
          Add {noun}
        </Button>
      </ConfigurationHeaderActions>

      <DataTable
        columns={columns}
        data={methods}
        getRowId={(method) => method.id}
        emptyContent={
          <EmptyState
            icon={icon}
            title={`No ${noun}s configured.`}
            description={`Use Add ${noun} to create one.`}
          />
        }
      />

      <MethodEditorDialog
        key={
          editor?.mode === 'edit' ? editor.method.id : (editor?.mode ?? 'none')
        }
        open={editor !== null}
        noun={noun}
        method={editor?.mode === 'edit' ? editor.method : null}
        methods={methods}
        schema={schema}
        mutation={mutation}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      />

      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setPendingRemoval(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingRemoval?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This {noun} will no longer be available in MID Creation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (pendingRemoval) removeMethod(pendingRemoval)
              }}
            >
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function MethodEditorDialog({
  open,
  noun,
  method,
  methods,
  schema,
  mutation,
  onOpenChange,
}: {
  open: boolean
  noun: string
  method: PaymentMethod | null
  methods: PaymentMethod[]
  schema: {
    safeParse: (value: unknown) =>
      | { success: true }
      | {
          success: false
          error: { issues: Array<{ path: PropertyKey[]; message: string }> }
        }
  }
  mutation: MethodMutation
  onOpenChange: (open: boolean) => void
}) {
  const [draft, setDraft] = useState<MethodDraft>(() =>
    method ? toDraft(method) : emptyDraft,
  )
  const [touched, setTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const errors = getDraftErrors(draft, methods, method?.id)
  const visibleErrors: DraftErrors = touched ? errors : {}
  const isEdit = method !== null

  function set(key: keyof MethodDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
    setFormError(null)
  }

  function handleSubmit() {
    setTouched(true)
    if (Object.keys(errors).length > 0) return
    const nextMethod: PaymentMethod = {
      id: method?.id ?? crypto.randomUUID(),
      label: draft.label.trim(),
      commissionRate: Number(draft.commissionRate),
      testing: { min: Number(draft.testingMin), max: Number(draft.testingMax) },
      live: { min: Number(draft.liveMin), max: Number(draft.liveMax) },
    }
    const nextMethods = isEdit
      ? methods.map((item) => (item.id === nextMethod.id ? nextMethod : item))
      : [...methods, nextMethod]
    const listError = Object.values(
      getValidationErrors(schema.safeParse(nextMethods)),
    )[0]
    if (listError) {
      setFormError(listError)
      return
    }
    mutation.mutate(nextMethods, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="first-letter:uppercase">
            {isEdit ? `Edit ${noun}` : `Add ${noun}`}
          </DialogTitle>
          <DialogDescription>
            Commission and transaction limits apply when this {noun} is selected
            in MID Creation.
          </DialogDescription>
        </DialogHeader>

        <form
          id="method-editor-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <FieldGroup className="gap-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <Field data-invalid={Boolean(visibleErrors.label)}>
                <FieldLabel htmlFor="method-label">Name</FieldLabel>
                <Input
                  id="method-label"
                  autoFocus
                  value={draft.label}
                  maxLength={80}
                  placeholder="e.g. JazzCash"
                  aria-invalid={Boolean(visibleErrors.label)}
                  disabled={mutation.isPending}
                  onChange={(event) => set('label', event.target.value)}
                />
                <FieldError>{visibleErrors.label}</FieldError>
              </Field>
              <NumberField
                id="method-commission"
                label="Commission"
                suffix="%"
                step="0.01"
                max={100}
                value={draft.commissionRate}
                error={visibleErrors.commissionRate}
                disabled={mutation.isPending}
                onChange={(value) => set('commissionRate', value)}
              />
            </div>

            <LimitFieldSet
              legend="Testing limit"
              prefix="testing"
              min={draft.testingMin}
              max={draft.testingMax}
              minError={visibleErrors.testingMin}
              maxError={visibleErrors.testingMax}
              disabled={mutation.isPending}
              onMinChange={(value) => set('testingMin', value)}
              onMaxChange={(value) => set('testingMax', value)}
            />
            <LimitFieldSet
              legend="Live limit"
              prefix="live"
              min={draft.liveMin}
              max={draft.liveMax}
              minError={visibleErrors.liveMin}
              maxError={visibleErrors.liveMax}
              disabled={mutation.isPending}
              onMinChange={(value) => set('liveMin', value)}
              onMaxChange={(value) => set('liveMax', value)}
            />

            {formError ? (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form="method-editor-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            {isEdit ? 'Save changes' : `Add ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LimitFieldSet({
  legend,
  prefix,
  min,
  max,
  minError,
  maxError,
  disabled,
  onMinChange,
  onMaxChange,
}: {
  legend: string
  prefix: string
  min: string
  max: string
  minError?: string
  maxError?: string
  disabled: boolean
  onMinChange: (value: string) => void
  onMaxChange: (value: string) => void
}) {
  return (
    <FieldSet className="gap-0">
      <FieldLegend variant="label" className="mb-2">
        {legend}
      </FieldLegend>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          id={`${prefix}-min`}
          label="Minimum"
          suffix="PKR"
          subtle
          value={min}
          error={minError}
          disabled={disabled}
          onChange={onMinChange}
        />
        <NumberField
          id={`${prefix}-max`}
          label="Maximum"
          suffix="PKR"
          subtle
          value={max}
          error={maxError}
          disabled={disabled}
          onChange={onMaxChange}
        />
      </div>
    </FieldSet>
  )
}

function NumberField({
  id,
  label,
  suffix,
  value,
  error,
  disabled,
  step = '1',
  max,
  subtle = false,
  onChange,
}: {
  id: string
  label: string
  suffix: string
  value: string
  error?: string
  disabled: boolean
  step?: string
  max?: number
  subtle?: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel
        htmlFor={id}
        className={subtle ? 'text-xs text-muted-foreground' : undefined}
      >
        {label}
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step={step}
          placeholder="0"
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className="text-right tabular-nums"
          onChange={(event) => onChange(event.target.value)}
        />
        <InputGroupAddon align="inline-end">{suffix}</InputGroupAddon>
      </InputGroup>
      <FieldError>{error}</FieldError>
    </Field>
  )
}

function LimitRange({ min, max }: { min: number; max: number }) {
  return (
    <span className="block truncate text-right tabular-nums">
      <span className="text-muted-foreground">PKR </span>
      {min.toLocaleString()} – {max.toLocaleString()}
    </span>
  )
}

function formatRate(rate: number) {
  return `${rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

function toDraft(method: PaymentMethod): MethodDraft {
  return {
    label: method.label,
    commissionRate: String(method.commissionRate),
    testingMin: String(method.testing.min),
    testingMax: String(method.testing.max),
    liveMin: String(method.live.min),
    liveMax: String(method.live.max),
  }
}

function parseAmount(value: string) {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getDraftErrors(
  draft: MethodDraft,
  methods: PaymentMethod[],
  currentId: string | undefined,
): DraftErrors {
  const errors: DraftErrors = {}
  const label = draft.label.trim()
  if (!label) {
    errors.label = 'Name is required.'
  } else if (
    methods.some(
      (item) =>
        item.id !== currentId &&
        item.label.trim().toLowerCase() === label.toLowerCase(),
    )
  ) {
    errors.label = 'A method with this name already exists.'
  }

  const commission = parseAmount(draft.commissionRate)
  if (commission === null) {
    errors.commissionRate = 'Required.'
  } else if (commission < 0 || commission > 100) {
    errors.commissionRate = 'Must be 0–100.'
  }

  for (const environment of ['testing', 'live'] as const) {
    const minKey = `${environment}Min` as const
    const maxKey = `${environment}Max` as const
    const min = parseAmount(draft[minKey])
    const max = parseAmount(draft[maxKey])
    if (min === null) errors[minKey] = 'Required.'
    else if (min < 0) errors[minKey] = 'Cannot be negative.'
    if (max === null) errors[maxKey] = 'Required.'
    else if (max < 0) errors[maxKey] = 'Cannot be negative.'
    else if (min !== null && max < min) {
      errors[maxKey] = 'Must be at least the minimum.'
    }
  }
  return errors
}
