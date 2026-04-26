import { useMemo, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { format } from 'date-fns'
import {
  Building2,
  Briefcase,
  CalendarIcon,
  CheckCircle2,
  CreditCard,
  FileText,
  Info,
  Mail,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  User,
} from 'lucide-react'
import { toast } from 'sonner'

import { useSubmitResubmissionMutation } from '#/apis/merchant-onboarding'
import type {
  ResubmissionContext,
  ResubmissionRejection,
} from '#/apis/merchant-onboarding'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import {
  Card,
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Separator } from '#/components/ui/separator'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import {
  ALLOWED_EXTENSIONS,
  BANK_NAMES,
  KIN_RELATIONS,
  MERCHANT_TYPES,
  WEBSITE_CMS_OPTIONS,
} from '#/schemas/merchant-onboarding.schema'

import { DocumentUploadField } from './document-upload-field'

interface ResubmissionFormProps {
  token: string
  context: ResubmissionContext
}

type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'url'
  | 'date'
  | 'select'
  | 'combobox'

type SectionKey =
  | 'submitter'
  | 'owner'
  | 'business'
  | 'classification'
  | 'financial'
  | 'nextOfKin'
  | 'documents'

type SectionConfig = {
  key: SectionKey
  title: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
}

type FieldConfig = {
  kind: FieldKind
  section: SectionKey
  className?: string
  placeholder?: string
  description?: string
  options?: ReadonlyArray<{ value: string; label: string }>
  required?: boolean
}

type TextErrors = Record<string, string>
type DocumentErrors = Record<string, string>

type DocumentDraft = {
  action: 'replace' | 'remove' | null
  file: File | null
}

const DOCUMENT_ACTION_PREFIX = '__document_action__:'

const SECTION_CONFIGS: Record<SectionKey, SectionConfig> = {
  submitter: {
    key: 'submitter',
    title: 'Submitter Information',
    description: 'Email address of the person submitting this form',
    icon: Mail,
    colorClass: 'bg-blue-500/10 text-blue-500',
  },
  owner: {
    key: 'owner',
    title: 'Owner Information',
    description: 'Details of the business owner',
    icon: User,
    colorClass: 'bg-amber-500/10 text-amber-500',
  },
  business: {
    key: 'business',
    title: 'Business Information',
    description: 'Basic business and contact details',
    icon: Building2,
    colorClass: 'bg-violet-500/10 text-violet-500',
  },
  classification: {
    key: 'classification',
    title: 'Business Classification',
    description: 'Merchant type and transaction estimates',
    icon: Briefcase,
    colorClass: 'bg-teal-500/10 text-teal-500',
  },
  financial: {
    key: 'financial',
    title: 'Financial Information',
    description: 'Bank account and settlement details',
    icon: CreditCard,
    colorClass: 'bg-green-500/10 text-green-500',
  },
  nextOfKin: {
    key: 'nextOfKin',
    title: 'Next of Kin',
    description: 'Emergency contact relationship',
    icon: Users,
    colorClass: 'bg-rose-500/10 text-rose-500',
  },
  documents: {
    key: 'documents',
    title: 'Documents',
    description: 'Upload or remove the requested documents',
    icon: FileText,
    colorClass: 'bg-orange-500/10 text-orange-500',
  },
}

const FIELD_CONFIGS: Partial<Record<string, FieldConfig>> = {
  submitterEmail: {
    kind: 'email',
    section: 'submitter',
    placeholder: 'email@example.com',
  },
  ownerFullName: {
    kind: 'text',
    section: 'owner',
    placeholder: "Enter owner's full name",
  },
  ownerPhone: {
    kind: 'text',
    section: 'owner',
    placeholder: 'Enter phone number',
  },
  businessName: {
    kind: 'text',
    section: 'business',
    placeholder: 'Enter business name',
  },
  businessPhone: {
    kind: 'text',
    section: 'business',
    placeholder: 'Enter business phone',
  },
  businessEmail: {
    kind: 'email',
    section: 'business',
    placeholder: 'business@example.com',
  },
  businessWebsite: {
    kind: 'url',
    section: 'business',
    placeholder: 'https://example.com',
  },
  businessAddress: {
    kind: 'textarea',
    section: 'business',
    className: 'sm:col-span-2',
    placeholder: 'Enter full business address',
  },
  websiteCms: {
    kind: 'select',
    section: 'business',
    options: WEBSITE_CMS_OPTIONS,
  },
  businessNature: {
    kind: 'text',
    section: 'business',
    placeholder: 'e.g. E-commerce, SaaS, Retail',
  },
  businessRegistrationDate: {
    kind: 'date',
    section: 'business',
  },
  businessDescription: {
    kind: 'textarea',
    section: 'business',
    className: 'sm:col-span-2',
    placeholder: 'Describe what your business does',
  },
  merchantType: {
    kind: 'select',
    section: 'classification',
    className: 'sm:col-span-2',
    description: 'This determines which documents are required below.',
    options: MERCHANT_TYPES,
  },
  estimatedMonthlyTransactions: {
    kind: 'text',
    section: 'classification',
    placeholder: 'e.g. 500',
  },
  estimatedMonthlyVolume: {
    kind: 'text',
    section: 'classification',
    placeholder: 'e.g. 1000000',
  },
  accountTitle: {
    kind: 'text',
    section: 'financial',
    placeholder: 'Enter account title',
  },
  bankName: {
    kind: 'combobox',
    section: 'financial',
  },
  branchName: {
    kind: 'text',
    section: 'financial',
    placeholder: 'Enter branch name',
  },
  accountNumberIban: {
    kind: 'text',
    section: 'financial',
    placeholder: 'Enter account number or IBAN',
  },
  swiftCode: {
    kind: 'text',
    section: 'financial',
    placeholder: 'Optional',
    description: 'Required only for international transfers.',
    required: false,
  },
  nextOfKinRelation: {
    kind: 'select',
    section: 'nextOfKin',
    options: KIN_RELATIONS,
  },
}

function SectionIcon({
  icon: Icon,
  colorClass,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
}) {
  return (
    <div className={`flex size-10 items-center justify-center rounded-lg ${colorClass}`}>
      <Icon className="size-5" />
    </div>
  )
}

function groupRejections(rejections: Array<ResubmissionRejection>) {
  const grouped = new Map<SectionKey, Array<ResubmissionRejection>>()

  for (const rejection of rejections) {
    const section = rejection.isDocument
      ? 'documents'
      : (FIELD_CONFIGS[rejection.fieldName]?.section ?? 'business')

    const items = grouped.get(section) ?? []
    items.push(rejection)
    grouped.set(section, items)
  }

  return Object.values(SECTION_CONFIGS)
    .map((section) => ({
      section,
      rejections: grouped.get(section.key) ?? [],
    }))
    .filter((entry) => entry.rejections.length > 0)
}

function createInitialTextValues(rejections: Array<ResubmissionRejection>) {
  const values: Record<string, string> = {}

  for (const rejection of rejections) {
    if (!rejection.isDocument) {
      values[rejection.fieldName] = rejection.currentValue ?? ''
    }
  }

  return values
}

function createInitialDocumentValues(rejections: Array<ResubmissionRejection>) {
  const values: Record<string, DocumentDraft> = {}

  for (const rejection of rejections) {
    if (rejection.isDocument) {
      values[rejection.fieldName] = {
        action: rejection.isRequired ? 'replace' : null,
        file: null,
      }
    }
  }

  return values
}

function validateTextField(rejection: ResubmissionRejection, value: string) {
  const config = FIELD_CONFIGS[rejection.fieldName]
  const trimmed = value.trim()
  const isRequired = config?.required ?? true

  if (isRequired && !trimmed) {
    return `${rejection.label} is required.`
  }

  if (!trimmed) {
    return null
  }

  if (
    rejection.fieldName === 'submitterEmail' ||
    rejection.fieldName === 'businessEmail'
  ) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(trimmed)) {
      return 'Must be a valid email address.'
    }
  }

  if (rejection.fieldName === 'businessWebsite') {
    try {
      const url = new URL(trimmed)
      if (!url.protocol.startsWith('http')) {
        return 'Must be a valid URL (include https://).'
      }
    } catch {
      return 'Must be a valid URL (include https://).'
    }
  }

  if (rejection.fieldName === 'businessRegistrationDate') {
    const date = new Date(`${trimmed}T00:00:00`)
    if (Number.isNaN(date.getTime())) {
      return 'Business registration date is invalid.'
    }
    if (date > new Date()) {
      return 'Registration date cannot be in the future.'
    }
  }

  if (rejection.fieldName === 'estimatedMonthlyTransactions') {
    const num = Number(trimmed)
    if (!Number.isInteger(num) || num <= 0) {
      return 'Must be a whole number greater than 0.'
    }
  }

  if (rejection.fieldName === 'estimatedMonthlyVolume') {
    const num = Number(trimmed)
    if (Number.isNaN(num) || num <= 0) {
      return 'Must be a number greater than 0.'
    }
  }

  const optionValues = new Set((config?.options ?? []).map((option) => option.value))
  if (optionValues.size > 0 && !optionValues.has(trimmed)) {
    return `Please select ${rejection.label.toLowerCase()}.`
  }

  return null
}

function validateTextValues(
  rejections: Array<ResubmissionRejection>,
  textValues: Record<string, string>,
) {
  const errors: TextErrors = {}

  for (const rejection of rejections) {
    if (rejection.isDocument) continue

    const error = validateTextField(
      rejection,
      textValues[rejection.fieldName] ?? '',
    )

    if (error) {
      errors[rejection.fieldName] = error
    }
  }

  return errors
}

function validateDocumentValues(
  rejections: Array<ResubmissionRejection>,
  documentValues: Record<string, DocumentDraft>,
) {
  const errors: DocumentErrors = {}

  for (const rejection of rejections) {
    if (!rejection.isDocument) continue

    const draft = documentValues[rejection.fieldName] ?? {
      action: null,
      file: null,
    }

    if (rejection.isRequired) {
      if (draft.action !== 'replace' || !draft.file) {
        errors[rejection.fieldName] = `${rejection.label} must be reuploaded.`
      }
      continue
    }

    if (draft.action !== 'replace' && draft.action !== 'remove') {
      errors[rejection.fieldName] = `Choose whether to reupload or remove ${rejection.label.toLowerCase()}.`
      continue
    }

    if (draft.action === 'replace' && !draft.file) {
      errors[rejection.fieldName] = `${rejection.label} must be reuploaded.`
    }
  }

  return errors
}

export function ResubmissionForm({ token, context }: ResubmissionFormProps) {
  const [textValues, setTextValues] = useState(() =>
    createInitialTextValues(context.rejections),
  )
  const [documentValues, setDocumentValues] = useState(() =>
    createInitialDocumentValues(context.rejections),
  )
  const [textErrors, setTextErrors] = useState<TextErrors>({})
  const [documentErrors, setDocumentErrors] = useState<DocumentErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const mutation = useSubmitResubmissionMutation(token)

  const expiresLabel = useMemo(() => {
    try {
      return format(new Date(context.expiresAt), 'PPP')
    } catch {
      return null
    }
  }, [context.expiresAt])

  const groupedSections = useMemo(
    () => groupRejections(context.rejections),
    [context.rejections],
  )

  function handleTextChange(fieldName: string, value: string) {
    setTextValues((current) => ({
      ...current,
      [fieldName]: value,
    }))

    setTextErrors((current) => {
      if (!current[fieldName]) return current
      const next = { ...current }
      delete next[fieldName]
      return next
    })
  }

  function handleDocumentChange(fieldName: string, file: File | null) {
    setDocumentValues((current) => ({
      ...current,
      [fieldName]: {
        action: file ? 'replace' : current[fieldName].action,
        file,
      },
    }))

    setDocumentErrors((current) => {
      if (!current[fieldName]) return current
      const next = { ...current }
      delete next[fieldName]
      return next
    })
  }

  function handleDocumentAction(
    fieldName: string,
    action: 'replace' | 'remove',
  ) {
    setDocumentValues((current) => ({
      ...current,
      [fieldName]: {
        action,
        file: action === 'replace' ? current[fieldName].file : null,
      },
    }))

    setDocumentErrors((current) => {
      if (!current[fieldName]) return current
      const next = { ...current }
      delete next[fieldName]
      return next
    })
  }

  function buildFormData() {
    const formData = new FormData()

    for (const rejection of context.rejections) {
      if (rejection.isDocument) {
        const draft = documentValues[rejection.fieldName]
        const action = draft.action
        if (!action) continue

        formData.append(`${DOCUMENT_ACTION_PREFIX}${rejection.fieldName}`, action)
        if (action === 'replace' && draft.file) {
          formData.append(rejection.fieldName, draft.file)
        }
        continue
      }

      formData.append(rejection.fieldName, textValues[rejection.fieldName] ?? '')
    }

    return formData
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const nextTextErrors = validateTextValues(context.rejections, textValues)
    const nextDocumentErrors = validateDocumentValues(
      context.rejections,
      documentValues,
    )

    setTextErrors(nextTextErrors)
    setDocumentErrors(nextDocumentErrors)

    if (
      Object.keys(nextTextErrors).length > 0 ||
      Object.keys(nextDocumentErrors).length > 0
    ) {
      toast.error('Please review the highlighted fields and submit all requested updates.')
      return
    }

    const formData = buildFormData()

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Merchant Onboarding</h1>
        <p className="mt-2 text-muted-foreground">
          Submit every requested correction for case {context.caseNumber}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update your submission</CardTitle>
          <CardDescription>
            {context.merchantName}
            {expiresLabel ? ` - this secure link expires ${expiresLabel}.` : '.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert>
            <Info />
            <AlertTitle>Complete resubmission required</AlertTitle>
            <AlertDescription>
              Every rejected field below must be addressed in this submission.
              Required documents must be reuploaded. Optional documents can be
              reuploaded or removed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {groupedSections.map(({ section, rejections }) => (
        <Card key={section.key}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <SectionIcon icon={section.icon} colorClass={section.colorClass} />
              <div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {section.key === 'documents' ? (
              <DocumentsSection
                rejections={rejections}
                documentValues={documentValues}
                documentErrors={documentErrors}
                onDocumentAction={handleDocumentAction}
                onDocumentChange={handleDocumentChange}
              />
            ) : (
              <FieldGroup className="grid gap-6 sm:grid-cols-2">
                {rejections.map((rejection) => (
                  <RejectionField
                    key={rejection.fieldName}
                    rejection={rejection}
                    value={textValues[rejection.fieldName] ?? ''}
                    error={textErrors[rejection.fieldName]}
                    onChange={(value) =>
                      handleTextChange(rejection.fieldName, value)
                    }
                  />
                ))}
              </FieldGroup>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <CheckCircle2 data-icon="inline-start" />
          )}
          {mutation.isPending ? 'Submitting...' : 'Submit updates'}
        </Button>
      </div>
    </form>
  )
}

function RejectionField({
  rejection,
  value,
  error,
  onChange,
}: {
  rejection: ResubmissionRejection
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const config = FIELD_CONFIGS[rejection.fieldName] ?? {
    kind: 'text' as const,
    section: 'business' as const,
  }
  const isInvalid = Boolean(error)

  return (
    <Field className={config.className} data-invalid={isInvalid}>
      <div className="flex items-center gap-2">
        <FieldLabel htmlFor={rejection.fieldName}>{rejection.label}</FieldLabel>
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          {(config.required ?? true) ? 'Required' : 'Optional'}
        </Badge>
      </div>

      <Alert variant="destructive">
        <ShieldAlert />
        <AlertTitle>Reviewer feedback</AlertTitle>
        <AlertDescription>
          {rejection.remarks ?? 'Please update this field.'}
        </AlertDescription>
      </Alert>

      <FieldControl
        rejection={rejection}
        value={value}
        onChange={onChange}
        config={config}
        isInvalid={isInvalid}
      />

      {config.description ? (
        <FieldDescription>{config.description}</FieldDescription>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </Field>
  )
}

function FieldControl({
  rejection,
  value,
  onChange,
  config,
  isInvalid,
}: {
  rejection: ResubmissionRejection
  value: string
  onChange: (value: string) => void
  config: FieldConfig
  isInvalid: boolean
}) {
  if (config.kind === 'textarea') {
    return (
      <Textarea
        id={rejection.fieldName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={isInvalid}
        className="min-h-24"
      />
    )
  }

  if (config.kind === 'date') {
    const selectedDate = value ? new Date(`${value}T00:00:00`) : undefined

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            type="button"
            data-empty={!value}
            className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
            aria-invalid={isInvalid}
          >
            <CalendarIcon data-icon="inline-start" />
            {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
            disabled={(date) => date > new Date()}
            captionLayout="dropdown"
            defaultMonth={selectedDate}
          />
        </PopoverContent>
      </Popover>
    )
  }

  if (config.kind === 'select' && config.options) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={rejection.fieldName} className="w-full" aria-invalid={isInvalid}>
          <SelectValue placeholder={`Select ${rejection.label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {config.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }

  if (config.kind === 'combobox') {
    return (
      <Combobox
        items={BANK_NAMES as unknown as string[]}
        value={value || null}
        onValueChange={(nextValue) => onChange(nextValue ?? '')}
      >
        <ComboboxInput
          placeholder="Search bank..."
          className="w-full"
          showClear
          aria-invalid={isInvalid}
        />
        <ComboboxContent>
          <ComboboxEmpty>No bank found.</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    )
  }

  return (
    <Input
      id={rejection.fieldName}
      type={config.kind === 'email' ? 'email' : config.kind === 'url' ? 'url' : 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={config.placeholder}
      aria-invalid={isInvalid}
    />
  )
}

function DocumentsSection({
  rejections,
  documentValues,
  documentErrors,
  onDocumentAction,
  onDocumentChange,
}: {
  rejections: Array<ResubmissionRejection>
  documentValues: Record<string, DocumentDraft>
  documentErrors: DocumentErrors
  onDocumentAction: (fieldName: string, action: 'replace' | 'remove') => void
  onDocumentChange: (fieldName: string, file: File | null) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <Info />
        <AlertDescription>
          Accepted formats: {ALLOWED_EXTENSIONS.join(', ')}. Maximum file size:
          10 MB per document.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        {rejections.map((rejection) => {
          const draft = documentValues[rejection.fieldName] ?? {
            action: rejection.isRequired ? 'replace' : null,
            file: null,
          }

          return (
            <DocumentResubmissionField
              key={rejection.fieldName}
              rejection={rejection}
              draft={draft}
              error={documentErrors[rejection.fieldName]}
              onDocumentAction={onDocumentAction}
              onDocumentChange={onDocumentChange}
            />
          )
        })}
      </div>
    </div>
  )
}

function DocumentResubmissionField({
  rejection,
  draft,
  error,
  onDocumentAction,
  onDocumentChange,
}: {
  rejection: ResubmissionRejection
  draft: DocumentDraft
  error?: string
  onDocumentAction: (fieldName: string, action: 'replace' | 'remove') => void
  onDocumentChange: (fieldName: string, file: File | null) => void
}) {
  const isInvalid = Boolean(error)

  return (
    <Field className="rounded-lg border p-4" data-invalid={isInvalid}>
      <div className="flex items-center gap-2">
        <FieldLabel>{rejection.label}</FieldLabel>
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          {rejection.isRequired ? 'Required' : 'Optional'}
        </Badge>
      </div>

      <Alert variant="destructive">
        <ShieldAlert />
        <AlertTitle>Reviewer feedback</AlertTitle>
        <AlertDescription>
          {rejection.remarks ?? 'Please upload an updated document.'}
        </AlertDescription>
      </Alert>

      {!rejection.isRequired ? (
        <>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={draft.action === 'replace' ? 'default' : 'outline'}
              onClick={() => onDocumentAction(rejection.fieldName, 'replace')}
            >
              <Upload data-icon="inline-start" />
              Reupload
            </Button>
            <Button
              type="button"
              variant={draft.action === 'remove' ? 'destructive' : 'outline'}
              onClick={() => onDocumentAction(rejection.fieldName, 'remove')}
            >
              <Trash2 data-icon="inline-start" />
              Remove document
            </Button>
          </div>
        </>
      ) : null}

      {draft.action === 'remove' && !rejection.isRequired ? (
        <Alert>
          <Info />
          <AlertDescription>
            This optional document will be removed from the submission.
          </AlertDescription>
        </Alert>
      ) : (
        <DocumentUploadField
          name={rejection.fieldName}
          label={rejection.label}
          required
          file={draft.file}
          onFileChange={(file) => onDocumentChange(rejection.fieldName, file)}
          error={draft.action === 'remove' ? undefined : error}
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
