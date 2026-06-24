import type { ComponentType, ReactNode, SVGProps } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BadgeDollarSign,
  ExternalLink,
  FileCheck2,
  FileText,
  FileUp,
  GitBranch,
  Landmark,
  LinkIcon,
  Mail,
  Play,
  Plus,
  Rocket,
  Save,
  Send,
  Store,
  Trash2,
  Wallet,
  Workflow,
  Upload,
  X,
} from 'lucide-react'

import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
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
import { Checkbox } from '#/components/ui/checkbox'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#/components/ui/combobox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
import { Spinner } from '#/components/ui/spinner'
import { ConfigurationPanelSkeleton } from './configuration-route-skeleton'
import { DEFAULT_SLA_HOURS } from '#/lib/sla'
import { cn } from '#/lib/utils'
import {
  caseFlowConfigurationQueryOptions,
  configurationQueryOptions,
  useCreateSubMerchantDraftMutation,
  useUpdateCaseFlowConfigurationMutation,
  useUpdateEmailSendingModeMutation,
  useUpdateLimitsAndMdrMutation,
  useUpdateLinkDeadlinesMutation,
  useUpdateMerchantPortalMutation,
  useUpdatePaymentMethodsMutation,
  useUpdatePayoutMethodsMutation,
  useUpdateQueueSlaMutation,
  useUpdateQueueStatusMutation,
  useUploadAgreementDraftMutation,
} from '#/hooks/use-configuration-query'
import {
  queuesQueryOptions,
  useCreateCaseMutation,
} from '#/hooks/use-cases-query'
import { merchantOptionsQueryOptions } from '#/hooks/use-merchants-query'
import type {
  CaseFlowCloseBlocker,
  CaseFlowCloseTrigger,
  CaseFlowConfiguration,
  CaseFlowCreationRequirement,
  CaseFlowStartRule,
  EmailSendingMode,
  LimitsAndMdrSettings,
  LinkDeadlineSettings,
  MerchantPortalSettings,
  PaymentMethodSettings,
  ConfigurationOverview,
} from '#/schemas/configuration.schema'
import type { MerchantListItem } from '#/schemas/merchants.schema'
import {
  emailSendingModeSchema,
  limitsAndMdrSettingsSchema,
  linkDeadlineSettingsSchema,
  merchantPortalSettingsSchema,
  paymentMethodSettingsSchema,
} from '#/schemas/configuration.schema'

type QueueOption = Pick<
  CaseFlowConfiguration['queues'][number],
  'id' | 'name'
> & {
  isActive?: boolean
}

const numberInputProps = {
  type: 'number',
  min: 0,
  step: '0.01',
  inputMode: 'decimal' as const,
}
const MAX_DRAFT_BYTES = 5 * 1024 * 1024
const DRAFT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx'])
type AgreementDraft = ConfigurationOverview['agreementDrafts'][number]

// ─── Limits & MDR ───────────────────────────────────────────────────────────

export function LimitsAndMdrPanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())
  const mutation = useUpdateLimitsAndMdrMutation()
  const [form, setForm] = useState<LimitsAndMdrSettings | null>(null)
  const value = form ?? data?.limitsAndMdr ?? null
  const validationErrors = value
    ? getValidationErrors(limitsAndMdrSettingsSchema.safeParse(value))
    : {}

  function update(path: string, nextValue: number) {
    setForm((current) => {
      const base = current ?? data?.limitsAndMdr
      if (!base) return current
      const next = structuredClone(base)
      const [group, key] = path.split('.') as [
        keyof LimitsAndMdrSettings,
        string,
      ]
      ;(next[group] as Record<string, number>)[key] = nextValue
      return next
    })
  }

  if (isPending || !value) {
    return <PanelLoading />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <LimitSection
          icon={BadgeDollarSign}
          colorClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          title="Testing Limits"
          description="Transaction ranges used before merchant go-live."
          prefix="testing"
          value={value.testing}
          errors={validationErrors}
          onChange={update}
        />
        <LimitSection
          icon={Rocket}
          colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          title="Live Limits"
          description="Production transaction ranges for live merchants."
          prefix="live"
          value={value.live}
          errors={validationErrors}
          onChange={update}
        />
        <RatesSection
          icon={Wallet}
          colorClass="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          value={value.rates}
          errors={validationErrors}
          onChange={update}
        />
      </div>
      <ConfigurationActionBar>
        <Button
          onClick={() => mutation.mutate(value)}
          disabled={mutation.isPending || hasValidationErrors(validationErrors)}
        >
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Save configuration
        </Button>
      </ConfigurationActionBar>
    </div>
  )
}

// ─── Agreements ─────────────────────────────────────────────────────────────

export function AgreementsPanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())

  const columns = useMemo<DataTableColumnDef<AgreementDraft>[]>(
    () => [
      {
        id: 'businessType',
        header: 'Business Type',
        width: 240,
        cell: (draft) => (
          <span className="truncate font-medium">{draft.label}</span>
        ),
      },
      {
        id: 'currentDraft',
        header: 'Current Draft',
        width: 280,
        cell: (draft) =>
          draft.googleDriveWebViewLink ? (
            <div className="flex min-w-0 items-center gap-2">
              <FileCheck2 className="shrink-0 text-muted-foreground" />
              <a
                href={draft.googleDriveWebViewLink}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-primary underline-offset-2 hover:underline"
              >
                {draft.originalName}
              </a>
            </div>
          ) : (
            <span className="text-muted-foreground">No draft</span>
          ),
      },
      {
        id: 'folder',
        header: 'Folder',
        width: 240,
        cell: (draft) => (
          <span className="truncate font-mono text-xs text-muted-foreground">
            Agreements / {draft.label}
          </span>
        ),
      },
      {
        id: 'upload',
        header: <span className="block text-right">Upload</span>,
        width: 380,
        cell: (draft) => <AgreementDraftUploadCell draft={draft} />,
      },
    ],
    [],
  )

  return (
    <ConfigurationSectionCard
      icon={FileText}
      colorClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      title="Agreement Drafts"
      description="Upload and review agreement templates by business type."
    >
      <DataTable
        columns={columns}
        data={data?.agreementDrafts ?? []}
        getRowId={(draft) => draft.businessType}
        isLoading={isPending}
        emptyContent={
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <p className="text-sm">No business types configured.</p>
          </div>
        }
      />
    </ConfigurationSectionCard>
  )
}

function AgreementDraftUploadCell({ draft }: { draft: AgreementDraft }) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadDraft = useUploadAgreementDraftMutation()
  const [file, setFile] = useState<File | null>(null)
  const fileError = getDraftFileError(file)

  function handleUpload() {
    if (!file || fileError || uploadDraft.isPending) return

    uploadDraft.mutate(
      {
        businessType: draft.businessType,
        file,
      },
      {
        onSuccess: () => {
          setFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        },
      },
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Field data-invalid={Boolean(fileError)} className="max-w-56">
        <Input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept=".pdf,.doc,.docx"
          aria-invalid={Boolean(fileError)}
          disabled={uploadDraft.isPending}
          onChange={(event) => {
            setFile(event.target.files?.item(0) ?? null)
          }}
        />
        <FieldError>{fileError}</FieldError>
      </Field>
      <Button
        type="button"
        variant="outline"
        disabled={!file || Boolean(fileError) || uploadDraft.isPending}
        onClick={handleUpload}
      >
        {uploadDraft.isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <FileUp data-icon="inline-start" />
        )}
        {uploadDraft.isPending ? 'Uploading' : 'Upload'}
      </Button>
    </div>
  )
}

// ─── Sub-Merchants ──────────────────────────────────────────────────────────

export function SubMerchantsPanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())

  type SubMerchant = NonNullable<typeof data>['subMerchants'][number]

  const existingNames = useMemo(
    () =>
      new Set(
        (data?.subMerchants ?? []).map((item) =>
          item.name.trim().toLowerCase(),
        ),
      ),
    [data?.subMerchants],
  )

  const columns = useMemo<DataTableColumnDef<SubMerchant>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        width: 240,
        cell: (item) => (
          <span className="truncate font-medium">{item.name}</span>
        ),
      },
      {
        id: 'draft',
        header: 'Draft',
        width: 280,
        cell: (item) => (
          <a
            href={item.googleDriveWebViewLink}
            target="_blank"
            rel="noreferrer"
            className="truncate text-primary underline-offset-2 hover:underline"
          >
            {item.originalName}
          </a>
        ),
      },
      {
        id: 'sellerCode',
        header: 'Seller Code',
        width: 180,
        cell: (item) => (
          <span className="truncate font-mono text-xs">{item.sellerCode}</span>
        ),
      },
      {
        id: 'folder',
        header: 'Folder',
        width: 240,
        cell: (item) => (
          <span className="truncate font-mono text-xs text-muted-foreground">
            Sub-Merchants / {item.name}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        header: 'Updated',
        width: 200,
        cell: (item) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(item.updatedAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: <span className="block text-right">Actions</span>,
        width: 160,
        cell: (item) => (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a
                href={item.googleDriveWebViewLink}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink data-icon="inline-start" />
                View draft
              </a>
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <ConfigurationSectionCard
      icon={Store}
      colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      title="Sub-Merchants"
      description="Manage draft forms and seller codes for sub-merchant onboarding."
      action={<AddSubMerchantDialog existingNames={existingNames} />}
    >
      <DataTable
        columns={columns}
        data={data?.subMerchants ?? []}
        getRowId={(item) => item.id}
        isLoading={isPending}
        emptyContent={
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <p className="text-sm">No sub-merchants yet.</p>
            <p className="text-xs">Use Add Sub-Merchant to create one.</p>
          </div>
        }
      />
    </ConfigurationSectionCard>
  )
}

// ─── Payment Methods ────────────────────────────────────────────────────────

export function PaymentMethodsPanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())
  const mutation = useUpdatePaymentMethodsMutation()

  return (
    <MethodListPanel
      data={data?.paymentMethods ?? null}
      isPending={isPending}
      mutation={mutation}
      icon={Wallet}
      colorClass="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
      title="Payment Methods"
      description="Manage collection methods available during MID Creation."
      addLabel="Add payment method"
      saveLabel="Save payment methods"
      emptyMessage="No payment methods configured."
    />
  )
}

export function PayoutMethodsPanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())
  const mutation = useUpdatePayoutMethodsMutation()

  return (
    <MethodListPanel
      data={data?.payoutMethods ?? null}
      isPending={isPending}
      mutation={mutation}
      icon={Send}
      colorClass="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
      title="Payout Methods"
      description="Manage payout methods available during MID Creation."
      addLabel="Add payout method"
      saveLabel="Save payout methods"
      emptyMessage="No payout methods configured."
    />
  )
}

function AddSubMerchantDialog({
  existingNames,
}: {
  existingNames: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [sellerCode, setSellerCode] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [touched, setTouched] = useState(false)
  const createDraft = useCreateSubMerchantDraftMutation()

  const trimmedName = name.trim()
  const nameError = !trimmedName
    ? 'Name is required.'
    : trimmedName.length < 2
      ? 'Name must be at least 2 characters.'
      : trimmedName.length > 80
        ? 'Name must be 80 characters or fewer.'
        : existingNames.has(trimmedName.toLowerCase())
          ? 'A sub-merchant with this name already exists.'
          : null
  const fileError = file
    ? getDraftFileError(file)
    : 'Please attach a draft file.'
  const trimmedSellerCode = sellerCode.trim()
  const sellerCodeError = !trimmedSellerCode
    ? 'Seller Code is required.'
    : trimmedSellerCode.length > 80
      ? 'Seller Code must be 80 characters or fewer.'
      : null
  const showNameError = touched && nameError
  const showSellerCodeError = touched && sellerCodeError
  const showFileError = touched && fileError

  function reset() {
    setName('')
    setSellerCode('')
    setFile(null)
    setTouched(false)
  }

  function handleSubmit() {
    setTouched(true)
    if (nameError || sellerCodeError || fileError || !file) return
    createDraft.mutate(
      { name: trimmedName, sellerCode: trimmedSellerCode, file },
      {
        onSuccess: () => {
          reset()
          setOpen(false)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (createDraft.isPending) return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          Add Sub-Merchant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Sub-Merchant</DialogTitle>
          <DialogDescription>
            Add a sub-merchant name and draft form. Files are stored under
            Configuration / Sub-Merchants.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field data-invalid={Boolean(showNameError)}>
            <FieldLabel htmlFor="add-sub-merchant-name">Name</FieldLabel>
            <Input
              id="add-sub-merchant-name"
              value={name}
              autoFocus
              placeholder="e.g. Acme Holdings"
              aria-invalid={Boolean(showNameError)}
              disabled={createDraft.isPending}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched(true)}
            />
            <FieldError>{showNameError ? nameError : null}</FieldError>
          </Field>

          <Field data-invalid={Boolean(showSellerCodeError)}>
            <FieldLabel htmlFor="add-sub-merchant-seller-code">
              Seller Code
            </FieldLabel>
            <Input
              id="add-sub-merchant-seller-code"
              value={sellerCode}
              placeholder="e.g. MST-715012"
              aria-invalid={Boolean(showSellerCodeError)}
              disabled={createDraft.isPending}
              onChange={(event) => setSellerCode(event.target.value)}
              onBlur={() => setTouched(true)}
            />
            <FieldError>
              {showSellerCodeError ? sellerCodeError : null}
            </FieldError>
          </Field>

          <Field data-invalid={Boolean(showFileError)}>
            <FieldLabel htmlFor="add-sub-merchant-draft">Draft form</FieldLabel>
            <DraftFileDropzone
              file={file}
              error={showFileError ? fileError : null}
              disabled={createDraft.isPending}
              onSelect={(next) => {
                setFile(next)
                setTouched(true)
              }}
              onClear={() => setFile(null)}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={createDraft.isPending}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createDraft.isPending}
          >
            {createDraft.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DraftFileDropzone({
  file,
  error,
  disabled,
  onSelect,
  onClear,
}: {
  file: File | null
  error: string | null
  disabled: boolean
  onSelect: (file: File) => void
  onClear: () => void
}) {
  const inputId = useId()
  const labelId = useId()
  const descriptionId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFile(next: File | undefined) {
    if (!next || disabled) return
    onSelect(next)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      data-slot="file-upload"
      dir="ltr"
      className="relative flex w-full flex-col gap-2"
    >
      <div
        role="region"
        id={descriptionId}
        aria-controls={inputId}
        aria-disabled={disabled}
        aria-invalid={Boolean(error)}
        data-slot="file-upload-dropzone"
        data-disabled={disabled ? true : undefined}
        data-dragging={isDragging ? true : undefined}
        data-invalid={error ? true : undefined}
        dir="ltr"
        tabIndex={disabled ? -1 : 0}
        className={cn(
          'relative flex min-h-36 select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 outline-none transition-colors hover:bg-accent/30 focus-visible:border-ring/50 data-disabled:pointer-events-none data-disabled:opacity-60 data-dragging:border-primary/30 data-dragging:bg-accent/30 data-invalid:border-destructive data-invalid:ring-destructive/20',
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          handleFile(event.dataTransfer.files[0])
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        {file ? (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-md border bg-muted p-2">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={onClear}
              aria-label="Remove file"
            >
              <X />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-full border-2 border-dashed border-muted-foreground/25 p-3">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Drop draft form here</p>
              <p className="text-xs text-muted-foreground">
                PDF, DOC, DOCX (max 5 MB)
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Upload data-icon="inline-start" />
              Browse files
            </Button>
          </div>
        )}
      </div>
      <Input
        ref={inputRef}
        id={inputId}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        accept=".pdf,.doc,.docx"
        className="sr-only"
        type="file"
        disabled={disabled}
        onChange={(event) => handleFile(event.target.files?.[0] ?? undefined)}
      />
      <div id={labelId} className="sr-only">
        File upload
      </div>
      <FieldError>{error}</FieldError>
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ─── Queues ─────────────────────────────────────────────────────────────────

export function QueuesPanel() {
  const { data: queues = [], isPending } = useQuery(
    queuesQueryOptions({ includeInactive: true }),
  )
  const updateStatus = useUpdateQueueStatusMutation()

  type Queue = (typeof queues)[number]

  const columns = useMemo<DataTableColumnDef<Queue>[]>(
    () => [
      {
        id: 'name',
        header: 'Queue',
        width: 260,
        cell: (queue) => (
          <span className="truncate font-medium">{queue.name}</span>
        ),
      },
      {
        id: 'slug',
        header: 'Slug',
        width: 220,
        cell: (queue) => (
          <span className="truncate font-mono text-xs">{queue.slug}</span>
        ),
      },
      {
        id: 'prefix',
        header: 'Prefix',
        width: 140,
        cell: (queue) => <span className="truncate">{queue.prefix}</span>,
      },
      {
        id: 'sla',
        header: 'SLA',
        width: 160,
        cell: (queue) => (
          <QueueSlaCell
            queueId={queue.id}
            queueName={queue.name}
            slaHours={queue.slaHours ?? DEFAULT_SLA_HOURS}
          />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        width: 140,
        cell: (queue) => {
          const isActive = queue.isActive !== false
          return (
            <Badge variant={isActive ? 'secondary' : 'outline'}>
              {isActive ? 'Active' : 'Inactive'}
            </Badge>
          )
        },
      },
      {
        id: 'actions',
        header: <span className="block text-right">Actions</span>,
        width: 180,
        cell: (queue) => {
          const isActive = queue.isActive !== false
          return (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={updateStatus.isPending}
                onClick={() =>
                  updateStatus.mutate({
                    queueId: queue.id,
                    isActive: !isActive,
                  })
                }
              >
                {isActive ? 'Set inactive' : 'Set active'}
              </Button>
            </div>
          )
        },
      },
    ],
    [updateStatus],
  )

  return (
    <ConfigurationSectionCard
      icon={Workflow}
      colorClass="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
      title="Queues"
      description="Manage queue availability, prefixes, and SLA hours."
    >
      <DataTable
        columns={columns}
        data={queues}
        getRowId={(queue) => queue.id}
        isLoading={isPending}
        emptyContent={
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <p className="text-sm">No queues configured.</p>
          </div>
        }
      />
    </ConfigurationSectionCard>
  )
}

function QueueSlaCell({
  queueId,
  queueName,
  slaHours,
}: {
  queueId: string
  queueName: string
  slaHours: number
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(slaHours))
  const updateSla = useUpdateQueueSlaMutation()

  useEffect(() => {
    if (open) {
      setValue(String(slaHours))
    }
  }, [open, slaHours])

  const parsed = Number(value)
  const isValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 8760

  function handleSave() {
    if (!isValid) return
    updateSla.mutate(
      { queueId, slaHours: parsed },
      { onSuccess: () => setOpen(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto cursor-pointer justify-start px-0 font-medium text-primary no-underline hover:bg-transparent hover:text-primary hover:underline hover:decoration-dashed hover:underline-offset-4"
        >
          {slaHours} {slaHours === 1 ? 'hour' : 'hours'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit SLA</DialogTitle>
          <DialogDescription>
            Set the SLA in hours for the {queueName} queue. Cases breach this
            SLA when the configured hours pass after creation.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={!isValid ? true : undefined}>
            <FieldLabel htmlFor={`sla-${queueId}`}>SLA in Hours</FieldLabel>
            <Input
              id={`sla-${queueId}`}
              type="number"
              min={1}
              max={8760}
              step={1}
              inputMode="numeric"
              value={value}
              aria-invalid={!isValid ? true : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isValid || updateSla.isPending}
          >
            {updateSla.isPending ? <Spinner data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Link Deadlines ─────────────────────────────────────────────────────────

export function LinkDeadlinesPanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())
  const mutation = useUpdateLinkDeadlinesMutation()
  const [form, setForm] = useState<LinkDeadlineSettings | null>(null)
  const value = form ?? data?.linkDeadlines ?? null
  const validationErrors = value
    ? getValidationErrors(linkDeadlineSettingsSchema.safeParse(value))
    : {}

  const fields = useMemo(
    () =>
      [
        ['passwordResetHours', 'Password reset'],
        ['newPasswordSetHours', 'New password set'],
        ['agreementLinkHours', 'Agreement link'],
        ['documentsReviewResubmissionHours', 'Documents review resubmission'],
        ['goLiveAvailabilityHours', 'Go Live availability'],
      ] as const,
    [],
  )

  if (isPending || !value) {
    return <PanelLoading />
  }

  return (
    <ConfigurationSectionCard
      icon={LinkIcon}
      colorClass="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      title="Link Deadlines"
      description="Configure expiry and availability windows for secure links."
    >
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fields.map(([key, label]) => (
            <Field key={key} data-invalid={Boolean(validationErrors[key])}>
              <FieldLabel htmlFor={key}>{label}</FieldLabel>
              <Input
                id={key}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="No expiry"
                value={value[key] ?? ''}
                aria-invalid={Boolean(validationErrors[key])}
                onChange={(event) => {
                  const raw = event.target.value
                  setForm((current) => ({
                    ...(current ?? value),
                    [key]: raw === '' ? null : Number(raw),
                  }))
                }}
              />
              <FieldDescription>
                Hours. Leave blank for no expiry.
              </FieldDescription>
              <FieldError>{validationErrors[key]}</FieldError>
            </Field>
          ))}
        </div>
        <ConfigurationActionBar>
          <Button
            onClick={() => mutation.mutate(value)}
            disabled={
              mutation.isPending || hasValidationErrors(validationErrors)
            }
          >
            {mutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <LinkIcon data-icon="inline-start" />
            )}
            Save deadlines
          </Button>
        </ConfigurationActionBar>
      </FieldGroup>
    </ConfigurationSectionCard>
  )
}

// ─── Email Sending Mode ───────────────────────────────────────────────────────

export function EmailSendingModePanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())
  const mutation = useUpdateEmailSendingModeMutation()
  const [form, setForm] = useState<EmailSendingMode | null>(null)
  const value = form ?? data?.emailSendingMode ?? null

  const validationResult = value
    ? emailSendingModeSchema.safeParse(value)
    : null
  const hasError = validationResult ? !validationResult.success : false
  const bothDisabledError =
    value && !value.autoEnabled && !value.manualEnabled
      ? 'At least one mode must be enabled.'
      : null

  function setMode(field: keyof EmailSendingMode, checked: boolean) {
    setForm((prev) => {
      const current = prev ??
        data?.emailSendingMode ?? {
          autoEnabled: true,
          manualEnabled: true,
        }
      return { ...current, [field]: checked }
    })
  }

  function handleSave() {
    if (!value || hasError) return
    mutation.mutate(value)
  }

  if (isPending || !value) {
    return <PanelLoading />
  }

  return (
    <ConfigurationSectionCard
      icon={Mail}
      colorClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      title="Email Sending"
      description="Choose how case emails are sent from the portal."
    >
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Email Sending Mode</FieldLegend>

          <Field orientation="horizontal">
            <Checkbox
              id="email-mode-auto"
              checked={value.autoEnabled}
              onCheckedChange={(checked) => {
                if (typeof checked === 'boolean') {
                  setMode('autoEnabled', checked)
                }
              }}
            />
            <FieldContent>
              <FieldLabel htmlFor="email-mode-auto">Auto (Resend)</FieldLabel>
              <FieldDescription>
                Emails are sent automatically through Resend when triggered.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="email-mode-manual"
              checked={value.manualEnabled}
              onCheckedChange={(checked) => {
                if (typeof checked === 'boolean') {
                  setMode('manualEnabled', checked)
                }
              }}
            />
            <FieldContent>
              <FieldLabel htmlFor="email-mode-manual">
                Manual (Gmail)
              </FieldLabel>
              <FieldDescription>
                Agent receives subject and body to copy-paste and send from
                Gmail manually.
              </FieldDescription>
            </FieldContent>
          </Field>

          <FieldError>{bothDisabledError}</FieldError>
        </FieldSet>

        <ConfigurationActionBar>
          <Button
            disabled={mutation.isPending || hasError || !form}
            onClick={handleSave}
          >
            {mutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Save email mode
          </Button>
        </ConfigurationActionBar>
      </FieldGroup>
    </ConfigurationSectionCard>
  )
}

// ─── Merchant Portal ───────────────────────────────────────────────────────

export function MerchantPortalPanel() {
  const { data, isPending } = useQuery(configurationQueryOptions())
  const mutation = useUpdateMerchantPortalMutation()
  const [form, setForm] = useState<MerchantPortalSettings | null>(null)
  const value = form ?? data?.merchantPortal ?? null
  const validationErrors = value
    ? getValidationErrors(merchantPortalSettingsSchema.safeParse(value))
    : {}

  if (isPending || !value) {
    return <PanelLoading />
  }

  return (
    <ConfigurationSectionCard
      icon={Send}
      colorClass="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
      title="Merchant Portal"
      description="Configure the portal link used in Testing and Live case emails."
    >
      <FieldGroup>
        <FieldSet>
          <Field data-invalid={Boolean(validationErrors.loginUrl)}>
            <FieldLabel htmlFor="merchant-portal-login-url">
              Merchant portal login URL
            </FieldLabel>
            <Input
              id="merchant-portal-login-url"
              type="url"
              value={value.loginUrl}
              placeholder="https://merchant.assanpay.com/login"
              aria-invalid={Boolean(validationErrors.loginUrl)}
              onChange={(event) => {
                setForm((current) => ({
                  ...(current ?? value),
                  loginUrl: event.target.value,
                }))
              }}
            />
            <FieldDescription>
              This URL appears as the merchant portal link in customer emails.
            </FieldDescription>
            <FieldError>{validationErrors.loginUrl}</FieldError>
          </Field>
        </FieldSet>
        <ConfigurationActionBar>
          <Button
            onClick={() => mutation.mutate(value)}
            disabled={
              mutation.isPending || hasValidationErrors(validationErrors)
            }
          >
            {mutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Save portal settings
          </Button>
        </ConfigurationActionBar>
      </FieldGroup>
    </ConfigurationSectionCard>
  )
}

// ─── Case Triggering ───────────────────────────────────────────────────────

export function CaseTriggeringPanel() {
  const [merchantSearch, setMerchantSearch] = useState('')
  const [selectedMerchant, setSelectedMerchant] =
    useState<MerchantListItem | null>(null)
  const [queueId, setQueueId] = useState('')
  const merchantsQuery = useQuery(merchantOptionsQueryOptions(merchantSearch))
  const queuesQuery = useQuery(queuesQueryOptions({ includeInactive: true }))
  const createCase = useCreateCaseMutation()
  const merchants = merchantsQuery.data?.merchants ?? []
  const queues = queuesQuery.data ?? []
  const selectedQueue = queues.find((queue) => queue.id === queueId)
  const canSubmit = Boolean(
    selectedMerchant?.id && queueId && selectedQueue?.isActive,
  )

  function handleSubmit() {
    if (!canSubmit || !selectedMerchant) return
    createCase.mutate(
      { merchantId: selectedMerchant.id, queueId },
      {
        onSuccess: () => {
          setSelectedMerchant(null)
          setMerchantSearch('')
          setQueueId('')
        },
      },
    )
  }

  if (merchantsQuery.isPending || queuesQuery.isPending) {
    return <PanelLoading />
  }

  return (
    <ConfigurationSectionCard
      icon={Play}
      colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      title="Case Triggering"
      description="Create a case manually for a selected merchant and queue."
    >
      <FieldGroup>
        <FieldSet>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>Merchant</FieldLabel>
              <MerchantCombobox
                merchants={merchants}
                value={selectedMerchant ?? null}
                isFetching={merchantsQuery.isFetching}
                onSearchValueChange={setMerchantSearch}
                onValueChange={setSelectedMerchant}
              />
              {merchantsQuery.isFetching ? (
                <FieldDescription>Loading merchants</FieldDescription>
              ) : null}
            </Field>

            <Field
              data-invalid={Boolean(selectedQueue && !selectedQueue.isActive)}
            >
              <FieldLabel>Queue</FieldLabel>
              <QueueSelect
                value={queueId}
                queues={queues}
                placeholder="Select queue"
                onValueChange={setQueueId}
              />
              {selectedQueue && !selectedQueue.isActive ? (
                <FieldError>This queue is inactive.</FieldError>
              ) : null}
            </Field>
          </div>
        </FieldSet>
        <ConfigurationActionBar>
          <Button
            disabled={!canSubmit || createCase.isPending}
            onClick={handleSubmit}
          >
            {createCase.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Play data-icon="inline-start" />
            )}
            Trigger case
          </Button>
        </ConfigurationActionBar>
      </FieldGroup>
    </ConfigurationSectionCard>
  )
}

// ─── Case Flow Rules ───────────────────────────────────────────────────────

export function CaseFlowRulesPanel() {
  const { data, isPending } = useQuery(caseFlowConfigurationQueryOptions())
  const mutation = useUpdateCaseFlowConfigurationMutation()
  const [form, setForm] = useState<CaseFlowConfiguration | null>(null)
  const value = form ?? data ?? null
  const queues = value?.queues ?? []
  const formError = value ? getCaseFlowFormError(value) : null

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  if (isPending || !value) {
    return <PanelLoading />
  }

  function update(next: CaseFlowConfiguration) {
    setForm(next)
  }

  return (
    <div className="flex flex-col gap-6">
      <ConfigurationSectionCard
        icon={Play}
        colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        title="First case after submission"
        description="When a merchant submits onboarding, automatically open these cases."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                ...value,
                startRules: [
                  ...value.startRules,
                  {
                    targetQueueId: '',
                    order: value.startRules.length + 1,
                    isActive: true,
                  },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add rule
          </Button>
        }
      >
        {value.startRules.length === 0 ? (
          <RuleListEmpty message="No first-case rules configured yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {value.startRules.map((rule, index) => (
              <StartRuleRow
                key={`start-${index}`}
                rule={rule}
                queues={queues}
                onChange={(nextRule) => {
                  const startRules = [...value.startRules]
                  startRules[index] = nextRule
                  update({ ...value, startRules })
                }}
                onRemove={() =>
                  update({
                    ...value,
                    startRules: value.startRules.filter((_, i) => i !== index),
                  })
                }
              />
            ))}
          </div>
        )}
      </ConfigurationSectionCard>

      <ConfigurationSectionCard
        icon={GitBranch}
        colorClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        title="Close triggers"
        description="When a case closes, automatically open another case for the same merchant."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                ...value,
                closeTriggers: [
                  ...value.closeTriggers,
                  {
                    sourceQueueId: '',
                    targetQueueId: '',
                    order: value.closeTriggers.length + 1,
                    isActive: true,
                  },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add trigger
          </Button>
        }
      >
        {value.closeTriggers.length === 0 ? (
          <RuleListEmpty message="No close triggers configured yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {value.closeTriggers.map((rule, index) => (
              <CloseTriggerRuleRow
                key={`trigger-${index}`}
                rule={rule}
                queues={queues}
                onChange={(nextRule) => {
                  const closeTriggers = [...value.closeTriggers]
                  closeTriggers[index] = nextRule
                  update({ ...value, closeTriggers })
                }}
                onRemove={() =>
                  update({
                    ...value,
                    closeTriggers: value.closeTriggers.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              />
            ))}
          </div>
        )}
      </ConfigurationSectionCard>

      <ConfigurationSectionCard
        icon={FileCheck2}
        colorClass="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        title="Close requirements"
        description="Prevent a case from closing until another case has closed first."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                ...value,
                closeBlockers: [
                  ...value.closeBlockers,
                  {
                    blockedQueueId: '',
                    prerequisiteQueueId: '',
                    isActive: true,
                  },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add requirement
          </Button>
        }
      >
        {value.closeBlockers.length === 0 ? (
          <RuleListEmpty message="No close requirements configured yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {value.closeBlockers.map((rule, index) => (
              <CloseBlockerRuleRow
                key={`blocker-${index}`}
                rule={rule}
                queues={queues}
                onChange={(nextRule) => {
                  const closeBlockers = [...value.closeBlockers]
                  closeBlockers[index] = nextRule
                  update({ ...value, closeBlockers })
                }}
                onRemove={() =>
                  update({
                    ...value,
                    closeBlockers: value.closeBlockers.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              />
            ))}
          </div>
        )}
      </ConfigurationSectionCard>

      <ConfigurationSectionCard
        icon={Landmark}
        colorClass="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
        title="Case creation requirements"
        description="Prevent creating a case until another case has closed successfully."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                ...value,
                creationRequirements: [
                  ...value.creationRequirements,
                  {
                    targetQueueId: '',
                    prerequisiteQueueId: '',
                    isActive: true,
                  },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add requirement
          </Button>
        }
      >
        {value.creationRequirements.length === 0 ? (
          <RuleListEmpty message="No case creation requirements configured yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {value.creationRequirements.map((rule, index) => (
              <CreationRequirementRow
                key={`creation-${index}`}
                rule={rule}
                queues={queues}
                onChange={(nextRule) => {
                  const creationRequirements = [...value.creationRequirements]
                  creationRequirements[index] = nextRule
                  update({ ...value, creationRequirements })
                }}
                onRemove={() =>
                  update({
                    ...value,
                    creationRequirements: value.creationRequirements.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              />
            ))}
          </div>
        )}
      </ConfigurationSectionCard>

      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Fix the errors below</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <ConfigurationActionBar>
        <Button
          disabled={mutation.isPending || Boolean(formError)}
          onClick={() => mutation.mutate(getActiveCaseFlowConfiguration(value))}
        >
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Save flow rules
        </Button>
      </ConfigurationActionBar>
    </div>
  )
}

// ─── Sections & helpers ─────────────────────────────────────────────────────

function StartRuleRow({
  rule,
  queues,
  onChange,
  onRemove,
}: {
  rule: CaseFlowStartRule
  queues: QueueOption[]
  onChange: (rule: CaseFlowStartRule) => void
  onRemove: () => void
}) {
  return (
    <FlowRuleRow
      onRemove={onRemove}
      fields={
        <div className="min-w-0 flex-1">
          <QueueSelect
            value={rule.targetQueueId}
            queues={queues}
            placeholder="Select first case to open"
            onValueChange={(targetQueueId) =>
              onChange({ ...rule, targetQueueId })
            }
          />
        </div>
      }
    />
  )
}

function CloseTriggerRuleRow({
  rule,
  queues,
  onChange,
  onRemove,
}: {
  rule: CaseFlowCloseTrigger
  queues: QueueOption[]
  onChange: (rule: CaseFlowCloseTrigger) => void
  onRemove: () => void
}) {
  return (
    <FlowRuleRow
      onRemove={onRemove}
      fields={
        <FlowRuleRelation
          left={
            <QueueSelect
              value={rule.sourceQueueId}
              queues={queues}
              placeholder="When this case closes"
              onValueChange={(sourceQueueId) =>
                onChange({ ...rule, sourceQueueId })
              }
            />
          }
          right={
            <QueueSelect
              value={rule.targetQueueId}
              queues={queues}
              placeholder="Open this case"
              onValueChange={(targetQueueId) =>
                onChange({ ...rule, targetQueueId })
              }
            />
          }
        />
      }
    />
  )
}

function CloseBlockerRuleRow({
  rule,
  queues,
  onChange,
  onRemove,
}: {
  rule: CaseFlowCloseBlocker
  queues: QueueOption[]
  onChange: (rule: CaseFlowCloseBlocker) => void
  onRemove: () => void
}) {
  return (
    <FlowRuleRow
      onRemove={onRemove}
      fields={
        <FlowRuleRelation
          left={
            <QueueSelect
              value={rule.blockedQueueId}
              queues={queues}
              placeholder="This case cannot close"
              onValueChange={(blockedQueueId) =>
                onChange({ ...rule, blockedQueueId })
              }
            />
          }
          right={
            <QueueSelect
              value={rule.prerequisiteQueueId}
              queues={queues}
              placeholder="Until this case closes"
              onValueChange={(prerequisiteQueueId) =>
                onChange({ ...rule, prerequisiteQueueId })
              }
            />
          }
        />
      }
    />
  )
}

function CreationRequirementRow({
  rule,
  queues,
  onChange,
  onRemove,
}: {
  rule: CaseFlowCreationRequirement
  queues: QueueOption[]
  onChange: (rule: CaseFlowCreationRequirement) => void
  onRemove: () => void
}) {
  return (
    <FlowRuleRow
      onRemove={onRemove}
      fields={
        <FlowRuleRelation
          left={
            <QueueSelect
              value={rule.targetQueueId}
              queues={queues}
              placeholder="Before creating this case"
              onValueChange={(targetQueueId) =>
                onChange({ ...rule, targetQueueId })
              }
            />
          }
          right={
            <QueueSelect
              value={rule.prerequisiteQueueId}
              queues={queues}
              placeholder="Require this case closed"
              onValueChange={(prerequisiteQueueId) =>
                onChange({ ...rule, prerequisiteQueueId })
              }
            />
          }
        />
      }
    />
  )
}

function FlowRuleRelation({
  left,
  right,
}: {
  left: ReactNode
  right: ReactNode
}) {
  return (
    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3">
      <div className="min-w-0">{left}</div>
      <ArrowRight
        className="hidden size-4 text-muted-foreground sm:block"
        aria-hidden
      />
      <div className="min-w-0">{right}</div>
    </div>
  )
}

function FlowRuleRow({
  fields,
  onRemove,
}: {
  fields: ReactNode
  onRemove: () => void
}) {
  return (
    <div className="group flex flex-col gap-3 rounded-md bg-muted/30 p-3 transition-colors sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center">{fields}</div>
      <div className="flex items-center justify-end gap-1 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove rule"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

function MerchantCombobox({
  merchants,
  value,
  isFetching,
  onSearchValueChange,
  onValueChange,
}: {
  merchants: MerchantListItem[]
  value: MerchantListItem | null
  isFetching: boolean
  onSearchValueChange: (value: string) => void
  onValueChange: (merchant: MerchantListItem | null) => void
}) {
  return (
    <Combobox
      items={merchants}
      value={value}
      autoHighlight
      itemToStringLabel={(merchant) => merchant.businessName}
      itemToStringValue={(merchant) => merchant.id}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      onInputValueChange={onSearchValueChange}
      onValueChange={(merchant) => onValueChange(merchant)}
    >
      <ComboboxInput
        className="w-full"
        placeholder="Search and select merchant"
        showClear
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {isFetching ? 'Loading merchants...' : 'No merchants found.'}
        </ComboboxEmpty>
        <ComboboxList>
          {(merchant: MerchantListItem) => (
            <ComboboxItem key={merchant.id} value={merchant}>
              <span className="min-w-0 flex-1 truncate">
                {merchant.businessName}
              </span>
              <Badge variant="secondary">#{merchant.merchantNumber}</Badge>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function QueueSelect({
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
              disabled={queue.isActive === false}
            >
              <span className="min-w-0 flex-1 truncate">{queue.name}</span>
              {queue.isActive === false ? (
                <Badge variant="outline">Inactive</Badge>
              ) : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function RuleListEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-8 text-center">
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">
        Click “Add” above to create one.
      </p>
    </div>
  )
}

function getCaseFlowFormError(value: CaseFlowConfiguration) {
  const requiredIds = [
    ...value.startRules.map((rule) => rule.targetQueueId),
    ...value.closeTriggers.flatMap((rule) => [
      rule.sourceQueueId,
      rule.targetQueueId,
    ]),
    ...value.closeBlockers.flatMap((rule) => [
      rule.blockedQueueId,
      rule.prerequisiteQueueId,
    ]),
    ...value.creationRequirements.flatMap((rule) => [
      rule.targetQueueId,
      rule.prerequisiteQueueId,
    ]),
  ]
  if (requiredIds.some((id) => !id)) return 'Select queues for every rule.'

  if (
    value.closeTriggers.some(
      (rule) => rule.sourceQueueId === rule.targetQueueId,
    )
  ) {
    return 'A queue cannot trigger itself.'
  }

  if (
    value.closeBlockers.some(
      (rule) => rule.blockedQueueId === rule.prerequisiteQueueId,
    )
  ) {
    return 'A queue cannot require itself before closing.'
  }

  if (hasDuplicates(value.startRules.map((rule) => rule.targetQueueId))) {
    return 'Each first-case queue can only be selected once.'
  }

  if (
    hasDuplicates(
      value.closeTriggers.map(
        (rule) => `${rule.sourceQueueId}:${rule.targetQueueId}`,
      ),
    )
  ) {
    return 'Each close trigger relation can only be configured once.'
  }

  if (
    hasDuplicates(
      value.closeBlockers.map(
        (rule) => `${rule.blockedQueueId}:${rule.prerequisiteQueueId}`,
      ),
    )
  ) {
    return 'Each close requirement relation can only be configured once.'
  }

  if (
    value.creationRequirements.some(
      (rule) => rule.targetQueueId === rule.prerequisiteQueueId,
    )
  ) {
    return 'A queue cannot require itself before creation.'
  }

  if (
    hasDuplicates(
      value.creationRequirements.map(
        (rule) => `${rule.targetQueueId}:${rule.prerequisiteQueueId}`,
      ),
    )
  ) {
    return 'Each case creation requirement relation can only be configured once.'
  }

  return null
}

function getActiveCaseFlowConfiguration(
  value: CaseFlowConfiguration,
): CaseFlowConfiguration {
  return {
    ...value,
    startRules: value.startRules.map((rule) => ({ ...rule, isActive: true })),
    closeTriggers: value.closeTriggers.map((rule) => ({
      ...rule,
      isActive: true,
    })),
    closeBlockers: value.closeBlockers.map((rule) => ({
      ...rule,
      isActive: true,
    })),
    creationRequirements: value.creationRequirements.map((rule) => ({
      ...rule,
      isActive: true,
    })),
  }
}

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length
}

function LimitSection({
  icon,
  colorClass,
  title,
  description,
  prefix,
  value,
  errors,
  onChange,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
  title: string
  description: string
  prefix: 'testing' | 'live'
  value: LimitsAndMdrSettings['testing']
  errors: Record<string, string>
  onChange: (path: string, value: number) => void
}) {
  return (
    <ConfigurationSectionCard
      icon={icon}
      colorClass={colorClass}
      title={title}
      description={description}
    >
      <FieldGroup>
        <AmountField
          id={`${prefix}-collection-min`}
          label="Collection Min"
          value={value.collectionMin}
          error={errors[`${prefix}.collectionMin`]}
          onChange={(next) => onChange(`${prefix}.collectionMin`, next)}
        />
        <AmountField
          id={`${prefix}-collection-max`}
          label="Collection Max"
          value={value.collectionMax}
          error={errors[`${prefix}.collectionMax`]}
          onChange={(next) => onChange(`${prefix}.collectionMax`, next)}
        />
        <AmountField
          id={`${prefix}-disbursement-min`}
          label="Disbursement Min"
          value={value.disbursementMin}
          error={errors[`${prefix}.disbursementMin`]}
          onChange={(next) => onChange(`${prefix}.disbursementMin`, next)}
        />
        <AmountField
          id={`${prefix}-disbursement-max`}
          label="Disbursement Max"
          value={value.disbursementMax}
          error={errors[`${prefix}.disbursementMax`]}
          onChange={(next) => onChange(`${prefix}.disbursementMax`, next)}
        />
      </FieldGroup>
    </ConfigurationSectionCard>
  )
}

function RatesSection({
  icon,
  colorClass,
  value,
  errors,
  onChange,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
  value: LimitsAndMdrSettings['rates']
  errors: Record<string, string>
  onChange: (path: string, value: number) => void
}) {
  return (
    <ConfigurationSectionCard
      icon={icon}
      colorClass={colorClass}
      title="Commission Rates"
      description="Global MDR and payout rates used by case emails and reviews."
    >
      <FieldGroup>
        <AmountField
          id="rate-ewallets"
          label="E-wallets / QR"
          value={value.eWallets}
          error={errors['rates.eWallets']}
          onChange={(next) => onChange('rates.eWallets', next)}
        />
        <AmountField
          id="rate-card-default"
          label="Card"
          value={value.cardDefault}
          error={errors['rates.cardDefault']}
          onChange={(next) => onChange('rates.cardDefault', next)}
        />
        <AmountField
          id="rate-card-shopify"
          label="Card Shopify"
          value={value.cardShopify}
          error={errors['rates.cardShopify']}
          onChange={(next) => onChange('rates.cardShopify', next)}
        />
        <AmountField
          id="rate-payout"
          label="Bank Settlement"
          value={value.payout}
          error={errors['rates.payout']}
          onChange={(next) => onChange('rates.payout', next)}
        />
      </FieldGroup>
    </ConfigurationSectionCard>
  )
}

function MethodListPanel({
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

  useEffect(() => {
    if (!data) return
    setForm((current) => current ?? data)
  }, [data])

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
              value
                .map((method) => ({
                  ...method,
                  label: method.label.trim(),
                }))
                .filter((method) => method.label),
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

function ConfigurationSectionCard({
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

function ConfigurationActionBar({ children }: { children: ReactNode }) {
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

function AmountField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  value: number
  error?: string
  onChange: (value: number) => void
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        {...numberInputProps}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <FieldError>{error}</FieldError>
    </Field>
  )
}

function PanelLoading() {
  return <ConfigurationPanelSkeleton />
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getValidationErrors(
  result:
    | { success: true }
    | {
        success: false
        error: {
          issues: Array<{ path: Array<string | number>; message: string }>
        }
      },
) {
  if (result.success) return {}

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.')
    if (!errors[key]) {
      errors[key] = issue.message
    }
  }
  return errors
}

function hasValidationErrors(errors: Record<string, string>) {
  return Object.keys(errors).length > 0
}

function getDraftFileError(file: File | null) {
  if (!file) return null
  if (file.size > MAX_DRAFT_BYTES) {
    return 'Draft file must be 5 MB or smaller.'
  }

  const dotIndex = file.name.lastIndexOf('.')
  const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : ''
  if (!DRAFT_EXTENSIONS.has(extension)) {
    return 'Draft file must be a PDF, DOC, or DOCX file.'
  }

  return null
}
