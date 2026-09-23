import { useId, useRef, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { ExternalLink, FileText, Plus, Store, Upload, X } from 'lucide-react'

import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
import { EmptyState } from '#/components/empty-state'

import { Button } from '#/components/ui/button'

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
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'

import { Input } from '#/components/ui/input'

import { Spinner } from '#/components/ui/spinner'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'

import { cn } from '#/lib/utils'

import {
  subMerchantDraftsQueryOptions,
  useCreateSubMerchantDraftMutation,
} from '#/hooks/use-configuration-query'

import { ConfigurationHeaderActions } from './configuration-panel-shared'
import { getDraftFileError } from './configuration-panel-utils'

// ─── Sub-Merchants ──────────────────────────────────────────────────────────
export function SubMerchantsPanel() {
  const { data, isPending } = useQuery(subMerchantDraftsQueryOptions())
  type SubMerchant = NonNullable<typeof data>[number]
  const existingNames = new Set(
    (data ?? []).map((item) => item.name.trim().toLowerCase()),
  )

  const columns: DataTableColumnDef<SubMerchant>[] = [
    {
      id: 'name',
      header: 'Name',
      width: 240,
      cell: (item) => <span className="truncate font-medium">{item.name}</span>,
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
      width: 80,
      cell: (item) => (
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <a
                  href={item.googleDriveWebViewLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-4" />
                  <span className="sr-only">View draft</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>View draft</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <>
      <ConfigurationHeaderActions>
        <AddSubMerchantDialog existingNames={existingNames} />
      </ConfigurationHeaderActions>
      <DataTable
        columns={columns}
        data={data ?? []}
        getRowId={(item) => item.id}
        isLoading={isPending}
        emptyContent={
          <EmptyState
            icon={Store}
            title="No sub-merchants yet."
            description="Use Add Sub-Merchant to create one."
          />
        }
      />
    </>
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
                PDF, DOC, DOCX (max 10 MB)
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

function formatDate(value: string) {
  return SUB_MERCHANT_DATE_FORMATTER.format(new Date(value))
}
const SUB_MERCHANT_DATE_FORMATTER = new Intl.DateTimeFormat('en-PK', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Karachi',
})
