import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileCheck2, FileText, FileUp, Upload, X } from 'lucide-react'
import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import {
  agreementDraftsQueryOptions,
  useUploadAgreementDraftMutation,
} from '#/hooks/use-configuration-query'
import type { AgreementDraft } from '#/schemas/configuration.schema'
import { getDraftFileError } from './configuration-panel-utils'

// ─── Agreements ─────────────────────────────────────────────────────────────
export function AgreementsPanel() {
  const { data, isPending } = useQuery(agreementDraftsQueryOptions())
  const columns: DataTableColumnDef<AgreementDraft>[] = [
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
      width: 280,
      cell: (draft) => <AgreementDraftUploadCell draft={draft} />,
    },
  ]
  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      getRowId={(draft) => draft.businessType}
      isLoading={isPending}
      emptyContent={
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <p className="text-sm">No business types configured.</p>
        </div>
      }
    />
  )
}
function AgreementDraftUploadCell({ draft }: { draft: AgreementDraft }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadDraft = useUploadAgreementDraftMutation()
  const [file, setFile] = useState<File | null>(null)
  const fileError = getDraftFileError(file)
  function clearSelection() {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  function handleUpload() {
    if (!file || fileError || uploadDraft.isPending) return
    uploadDraft.mutate(
      {
        businessType: draft.businessType,
        file,
      },
      {
        onSuccess: clearSelection,
      },
    )
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="sr-only"
          tabIndex={-1}
          aria-label={`Upload draft for ${draft.label}`}
          disabled={uploadDraft.isPending}
          onChange={(event) => {
            setFile(event.target.files?.item(0) ?? null)
          }}
        />
        {file ? (
          <>
            <span className="flex min-w-0 max-w-48 items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 text-xs">
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{file.name}</span>
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={Boolean(fileError) || uploadDraft.isPending}
                    onClick={handleUpload}
                    aria-label="Upload draft"
                  />
                }
              >
                {uploadDraft.isPending ? <Spinner /> : <Upload />}
              </TooltipTrigger>
              <TooltipContent>
                {uploadDraft.isPending ? 'Uploading' : 'Upload draft'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    disabled={uploadDraft.isPending}
                    onClick={clearSelection}
                    aria-label="Clear selected file"
                  />
                }
              >
                <X />
              </TooltipTrigger>
              <TooltipContent>Clear</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Select file"
                />
              }
            >
              <FileUp />
            </TooltipTrigger>
            <TooltipContent>Select file</TooltipContent>
          </Tooltip>
        )}
      </div>
      {fileError ? (
        <p className="text-xs text-destructive">{fileError}</p>
      ) : null}
    </div>
  )
}
