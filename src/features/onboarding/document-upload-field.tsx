import { useRef, useState } from 'react'
import { FileText, Upload, X } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_FILE_TYPES,
} from '#/schemas/merchant-onboarding.schema'
import { MAX_FILE_SIZE_BYTES } from '#/lib/file-limits'
import { cn } from '#/lib/utils'

type DocumentUploadFieldProps = {
  name: string
  label: string
  required?: boolean
  file: File | null
  onFileChange: (file: File | null) => void
  onValidationError?: (message: string) => void
  error?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File exceeds 10 MB limit (${formatFileSize(file.size)}).`
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
  }

  return null
}

export function DocumentUploadField({
  name,
  label,
  required = false,
  file,
  onFileChange,
  onValidationError,
  error,
}: DocumentUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [hasReturnedToPicker, setHasReturnedToPicker] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    const validationError = validateFile(selected)
    if (validationError) {
      onFileChange(null)
      onValidationError?.(validationError)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    onFileChange(selected)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleRemove() {
    setIsRemoving(true)
  }

  function finishRemove(event: React.TransitionEvent<HTMLDivElement>) {
    if (
      !isRemoving ||
      event.target !== event.currentTarget ||
      event.propertyName !== 'opacity'
    ) {
      return
    }

    setIsRemoving(false)
    setHasReturnedToPicker(true)
    onFileChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={cn('flex flex-col gap-1.5', error && 'text-destructive')}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {required ? (
          <Badge
            variant="secondary"
            className="bg-destructive/10 px-1.5 py-0 text-[10px] text-destructive hover:bg-destructive/10"
          >
            Required
          </Badge>
        ) : (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            Optional
          </Badge>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleChange}
        className="hidden"
      />

      {file ? (
        <div
          data-motion={isRemoving ? 'exiting' : 'entering'}
          className="motion-file-state flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2"
          onTransitionEnd={finishRemove}
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
            <span className="truncate text-sm">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={handleRemove}
          >
            <X />
            <span className="sr-only">Remove {label}</span>
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          data-motion={hasReturnedToPicker ? 'returning' : undefined}
          className={cn(
            'justify-start gap-2',
            hasReturnedToPicker && 'motion-file-state',
          )}
          onClick={() => inputRef.current?.click()}
        >
          <Upload data-icon="inline-start" />
          Choose file
        </Button>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
