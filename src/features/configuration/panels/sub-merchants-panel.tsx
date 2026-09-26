import { useId, useRef, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import {
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Save,
  Store,
  Upload,
  X,
} from 'lucide-react'

import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
import { EmptyState } from '#/components/empty-state'

import { Button, ButtonLink } from '#/components/ui/button'

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
  FieldDescription,
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
  useUpdateSubMerchantDraftMutation,
} from '#/hooks/use-configuration-query'
import { useRetainedValue } from '#/hooks/use-retained-value'
import type { SubMerchantDraft } from '#/schemas/configuration.schema'

import { ConfigurationHeaderActions } from './configuration-panel-shared'
import { getDraftFileError } from './configuration-panel-utils'

type SubMerchantEditor =
  | { mode: 'create' }
  | { mode: 'edit'; subMerchant: SubMerchantDraft }

// ─── Sub-Merchants ──────────────────────────────────────────────────────────
export function SubMerchantsPanel() {
  const { data, isPending, error, refetch } = useQuery(
    subMerchantDraftsQueryOptions(),
  )
  const [editor, setEditor] = useState<SubMerchantEditor | null>(null)
  // Bumped on every open so the form starts fresh.
  const [editorKey, setEditorKey] = useState(0)
  // Keep the last editor target through the dialog exit animation.
  const shownEditor = useRetainedValue(editor)
  const subMerchants = data ?? []

  const openEditor = (next: SubMerchantEditor) => {
    setEditorKey((key) => key + 1)
    setEditor(next)
  }

  const columns: DataTableColumnDef<SubMerchantDraft>[] = [
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
      width: 100,
      cell: (item) => (
        <div className="flex justify-end gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() =>
                    openEditor({ mode: 'edit', subMerchant: item })
                  }
                />
              }
            >
              <Pencil className="size-4" />
              <span className="sr-only">Edit {item.name}</span>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ButtonLink
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  render={
                    <a
                      href={item.googleDriveWebViewLink}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                />
              }
            >
              <ExternalLink className="size-4" />
              <span className="sr-only">View draft</span>
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
        <Button size="sm" onClick={() => openEditor({ mode: 'create' })}>
          <Plus data-icon="inline-start" />
          Add Sub-Merchant
        </Button>
      </ConfigurationHeaderActions>
      <DataTable
        columns={columns}
        data={subMerchants}
        getRowId={(item) => item.id}
        isLoading={isPending}
        error={error}
        onRetry={() => void refetch()}
        emptyContent={
          <EmptyState
            icon={Store}
            title="No sub-merchants yet."
            description="Use Add Sub-Merchant to create one."
          />
        }
      />

      <SubMerchantDialog
        key={editorKey}
        open={editor !== null}
        subMerchant={
          shownEditor?.mode === 'edit' ? shownEditor.subMerchant : null
        }
        subMerchants={subMerchants}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      />
    </>
  )
}

function SubMerchantDialog({
  open,
  subMerchant,
  subMerchants,
  onOpenChange,
}: {
  open: boolean
  subMerchant: SubMerchantDraft | null
  subMerchants: SubMerchantDraft[]
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = subMerchant !== null
  const [name, setName] = useState(subMerchant?.name ?? '')
  const [sellerCode, setSellerCode] = useState(subMerchant?.sellerCode ?? '')
  const [file, setFile] = useState<File | null>(null)
  // Errors appear only after the first submit attempt, so blurring a field
  // (e.g. by clicking outside to close) never flashes validation messages.
  const [submitted, setSubmitted] = useState(false)
  const createDraft = useCreateSubMerchantDraftMutation()
  const updateDraft = useUpdateSubMerchantDraftMutation()
  const isPending = createDraft.isPending || updateDraft.isPending
  const others = subMerchants.filter((item) => item.id !== subMerchant?.id)

  const trimmedName = name.trim()
  const nameError = !trimmedName
    ? 'Name is required.'
    : trimmedName.length < 2
      ? 'Name must be at least 2 characters.'
      : trimmedName.length > 80
        ? 'Name must be 80 characters or fewer.'
        : others.some(
              (item) =>
                item.name.trim().toLowerCase() === trimmedName.toLowerCase(),
            )
          ? 'A sub-merchant with this name already exists.'
          : null
  const trimmedSellerCode = sellerCode.trim()
  const sellerCodeError = !trimmedSellerCode
    ? 'Seller Code is required.'
    : trimmedSellerCode.length > 80
      ? 'Seller Code must be 80 characters or fewer.'
      : others.some(
            (item) =>
              item.sellerCode.trim().toLowerCase() ===
              trimmedSellerCode.toLowerCase(),
          )
        ? 'A sub-merchant with this Seller Code already exists.'
        : null
  const fileError = file
    ? getDraftFileError(file)
    : isEdit
      ? null
      : 'Please attach a draft file.'
  const showNameError = submitted ? nameError : null
  const showSellerCodeError = submitted ? sellerCodeError : null
  // A rejected file type is reported as soon as it is picked.
  const showFileError = submitted || file ? fileError : null

  function handleSubmit() {
    setSubmitted(true)
    if (nameError || sellerCodeError || fileError) return
    const onSuccess = () => onOpenChange(false)
    if (subMerchant) {
      updateDraft.mutate(
        {
          id: subMerchant.id,
          name: trimmedName,
          sellerCode: trimmedSellerCode,
          file,
        },
        { onSuccess },
      )
      return
    }
    if (!file) return
    createDraft.mutate(
      { name: trimmedName, sellerCode: trimmedSellerCode, file },
      { onSuccess },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Sub-Merchant' : 'Add Sub-Merchant'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the name or Seller Code, or upload a new draft form to replace the current one.'
              : 'Add a sub-merchant name and draft form. Files are stored under Configuration / Sub-Merchants.'}
          </DialogDescription>
        </DialogHeader>

        <form
          id="sub-merchant-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <FieldGroup>
            <Field data-invalid={Boolean(showNameError)}>
              <FieldLabel htmlFor="sub-merchant-name">Name</FieldLabel>
              <Input
                id="sub-merchant-name"
                value={name}
                autoFocus
                placeholder="e.g. Acme Holdings"
                aria-invalid={Boolean(showNameError)}
                disabled={isPending}
                onChange={(event) => setName(event.target.value)}
              />
              <FieldError>{showNameError}</FieldError>
            </Field>

            <Field data-invalid={Boolean(showSellerCodeError)}>
              <FieldLabel htmlFor="sub-merchant-seller-code">
                Seller Code
              </FieldLabel>
              <Input
                id="sub-merchant-seller-code"
                value={sellerCode}
                placeholder="e.g. MST-715012"
                aria-invalid={Boolean(showSellerCodeError)}
                disabled={isPending}
                onChange={(event) => setSellerCode(event.target.value)}
              />
              <FieldError>{showSellerCodeError}</FieldError>
            </Field>

            <Field data-invalid={Boolean(showFileError)}>
              <FieldLabel>
                {isEdit ? 'Replace draft form' : 'Draft form'}
              </FieldLabel>
              {subMerchant ? (
                <FieldDescription>
                  Current draft:{' '}
                  <a
                    href={subMerchant.googleDriveWebViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline underline-offset-4"
                  >
                    {subMerchant.originalName}
                  </a>
                  . Leave empty to keep it.
                </FieldDescription>
              ) : null}
              <DraftFileDropzone
                file={file}
                error={showFileError}
                disabled={isPending}
                onSelect={setFile}
                onClear={() => setFile(null)}
              />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline" disabled={isPending} />
            }
          >
            Cancel
          </DialogClose>
          <Button type="submit" form="sub-merchant-form" disabled={isPending}>
            {isPending ? (
              <Spinner data-icon="inline-start" />
            ) : isEdit ? (
              <Save data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            {isEdit ? 'Save' : 'Add'}
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
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={onClear}
                    aria-label="Remove file"
                  />
                }
              >
                <X />
              </TooltipTrigger>
              <TooltipContent>Remove file</TooltipContent>
            </Tooltip>
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
