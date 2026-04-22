import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileUp, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import {
  type ResubmissionContext,
  type ResubmissionRejection,
  useSubmitResubmissionMutation,
} from '#/apis/merchant-onboarding'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'

interface ResubmissionFormProps {
  token: string
  context: ResubmissionContext
}

type FieldValueState = {
  text: Record<string, string>
  files: Record<string, File | null>
}

function useInitialState(rejections: Array<ResubmissionRejection>) {
  return useMemo<FieldValueState>(() => {
    const text: Record<string, string> = {}
    const files: Record<string, File | null> = {}
    for (const r of rejections) {
      if (r.isDocument) {
        files[r.fieldName] = null
      } else {
        text[r.fieldName] = r.currentValue ?? ''
      }
    }
    return { text, files }
  }, [rejections])
}

export function ResubmissionForm({ token, context }: ResubmissionFormProps) {
  const initial = useInitialState(context.rejections)
  const [textValues, setTextValues] = useState(initial.text)
  const [fileValues, setFileValues] = useState(initial.files)
  const [submitted, setSubmitted] = useState(false)
  const mutation = useSubmitResubmissionMutation(token)

  const expiresLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
      }).format(new Date(context.expiresAt))
    } catch {
      return null
    }
  }, [context.expiresAt])

  function buildFormData() {
    const formData = new FormData()
    for (const r of context.rejections) {
      if (r.isDocument) {
        const file = fileValues[r.fieldName]
        if (file) {
          formData.append(r.fieldName, file)
        }
      } else {
        const value = (textValues[r.fieldName] ?? '').trim()
        const original = (r.currentValue ?? '').trim()
        // Only send fields the user actually changed
        if (value && value !== original) {
          formData.append(r.fieldName, value)
        }
      }
    }
    return formData
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const formData = buildFormData()

    if ([...formData.keys()].length === 0) {
      toast.error('Please update at least one field before submitting.')
      return
    }

    mutation.mutate(formData, {
      onSuccess: () => {
        setSubmitted(true)
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to submit updates.',
        )
      },
    })
  }

  if (submitted) {
    return <ResubmissionSuccess caseNumber={context.caseNumber} />
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Update your submission</CardTitle>
          <CardDescription>
            Case {context.caseNumber} — {context.merchantName}.
            {expiresLabel ? ` This link expires ${expiresLabel}.` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {context.rejections.map((rejection) => (
              <RejectionField
                key={rejection.fieldName}
                rejection={rejection}
                textValue={textValues[rejection.fieldName] ?? ''}
                fileValue={fileValues[rejection.fieldName] ?? null}
                onTextChange={(value) =>
                  setTextValues((prev) => ({
                    ...prev,
                    [rejection.fieldName]: value,
                  }))
                }
                onFileChange={(file) =>
                  setFileValues((prev) => ({
                    ...prev,
                    [rejection.fieldName]: file,
                  }))
                }
              />
            ))}
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <CheckCircle2 data-icon="inline-start" />
          )}
          {mutation.isPending ? 'Submitting' : 'Submit updates'}
        </Button>
      </div>
    </form>
  )
}

interface RejectionFieldProps {
  rejection: ResubmissionRejection
  textValue: string
  fileValue: File | null
  onTextChange: (value: string) => void
  onFileChange: (file: File | null) => void
}

function RejectionField({
  rejection,
  textValue,
  fileValue,
  onTextChange,
  onFileChange,
}: RejectionFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isLongText =
    rejection.fieldName === 'businessAddress' ||
    rejection.fieldName === 'businessDescription'

  return (
    <Field>
      <FieldLabel htmlFor={rejection.fieldName}>{rejection.label}</FieldLabel>
      <Alert variant="destructive">
        <ShieldAlert />
        <AlertTitle>Reviewer feedback</AlertTitle>
        <AlertDescription>
          {rejection.remarks ?? 'Please update this field.'}
        </AlertDescription>
      </Alert>

      {rejection.isDocument ? (
        <div className="flex flex-col gap-2">
          {rejection.currentDocumentName ? (
            <FieldDescription>
              Current file: {rejection.currentDocumentName}
            </FieldDescription>
          ) : null}
          <input
            ref={fileInputRef}
            id={rejection.fieldName}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              onFileChange(file)
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp data-icon="inline-start" />
              {fileValue ? 'Replace file' : 'Choose new file'}
            </Button>
            {fileValue ? (
              <span className="text-sm text-muted-foreground">
                {fileValue.name}
              </span>
            ) : null}
          </div>
        </div>
      ) : isLongText ? (
        <Textarea
          id={rejection.fieldName}
          value={textValue}
          onChange={(event) => onTextChange(event.target.value)}
          required
          className="min-h-24"
        />
      ) : (
        <Input
          id={rejection.fieldName}
          value={textValue}
          onChange={(event) => onTextChange(event.target.value)}
          required
        />
      )}
    </Field>
  )
}

function ResubmissionSuccess({ caseNumber }: { caseNumber: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-green-600" />
          Updates submitted
        </CardTitle>
        <CardDescription>
          Thank you. Case {caseNumber} has been returned to our team for
          review. You can close this window.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
