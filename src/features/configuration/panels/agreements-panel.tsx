import { useId, useMemo, useRef, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { FileCheck2, FileText, FileUp } from 'lucide-react'

import { DataTable } from '#/components/data-table'

import type { DataTableColumnDef } from '#/components/data-table'

import { Button } from '#/components/ui/button'

import { Field, FieldError } from '#/components/ui/field'

import { Input } from '#/components/ui/input'

import { Spinner } from '#/components/ui/spinner'

import {
  configurationQueryOptions,
  useUploadAgreementDraftMutation,
} from '#/hooks/use-configuration-query'

import type { ConfigurationOverview } from '#/schemas/configuration.schema'

import {
  ConfigurationSectionCard,
  getDraftFileError,
} from './configuration-panel-shared'

type AgreementDraft = ConfigurationOverview['agreementDrafts'][number]

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
