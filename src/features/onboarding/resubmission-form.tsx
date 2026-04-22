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

type FieldValueState = {
  text: Record<string, string>
  files: Record<string, File | null>
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
}

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
    description: 'Upload required documents for verification',
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

function useInitialState(rejections: Array<ResubmissionRejection>) {
  return useMemo<FieldValueState>(() => {
    const text: Record<string, string> = {}
    const files: Record<string, File | null> = {}

    for (const rejection of rejections) {
      if (rejection.isDocument) {
        files[rejection.fieldName] = null
      } else {
        text[rejection.fieldName] = rejection.currentValue ?? ''
      }
    }

    return { text, files }
  }, [rejections])
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

function formatCurrentValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : 'No current value available'
}

export function ResubmissionForm({ token, context }: ResubmissionFormProps) {
  const initial = useInitialState(context.rejections)
  const [textValues, setTextValues] = useState(initial.text)
  const [fileValues, setFileValues] = useState(initial.files)
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

  function buildFormData() {
    const formData = new FormData()

    for (const rejection of context.rejections) {
      if (rejection.isDocument) {
        const file = fileValues[rejection.fieldName]
        if (file) {
          formData.append(rejection.fieldName, file)
        }
        continue
      }

      const value = (textValues[rejection.fieldName] ?? '').trim()
      const original = (rejection.currentValue ?? '').trim()

      if (value && value !== original) {
        formData.append(rejection.fieldName, value)
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Merchant Onboarding</h1>
        <p className="mt-2 text-muted-foreground">
          Update only the requested fields for case {context.caseNumber}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update your submission</CardTitle>
          <CardDescription>
            {context.merchantName}
            {expiresLabel ? ` — this secure link expires ${expiresLabel}.` : '.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert>
            <Info />
            <AlertTitle>Requested updates only</AlertTitle>
            <AlertDescription>
              We have limited this form to the rejected fields from your earlier
              submission so you can correct only what needs attention.
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
                fileValues={fileValues}
                onFileChange={(fieldName, file) =>
                  setFileValues((prev) => ({
                    ...prev,
                    [fieldName]: file,
                  }))
                }
              />
            ) : (
              <FieldGroup className="grid gap-6 sm:grid-cols-2">
                {rejections.map((rejection) => (
                  <RejectionField
                    key={rejection.fieldName}
                    rejection={rejection}
                    value={textValues[rejection.fieldName] ?? ''}
                    onChange={(value) =>
                      setTextValues((prev) => ({
                        ...prev,
                        [rejection.fieldName]: value,
                      }))
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
  onChange,
}: {
  rejection: ResubmissionRejection
  value: string
  onChange: (value: string) => void
}) {
  const config = FIELD_CONFIGS[rejection.fieldName] ?? {
    kind: 'text' as const,
    section: 'business' as const,
  }

  return (
    <Field className={config.className}>
      <FieldLabel htmlFor={rejection.fieldName}>{rejection.label}</FieldLabel>

      <Alert variant="destructive">
        <ShieldAlert />
        <AlertTitle>Reviewer feedback</AlertTitle>
        <AlertDescription>
          {rejection.remarks ?? 'Please update this field.'}
        </AlertDescription>
      </Alert>

      <FieldDescription>
        Current value: {formatCurrentValue(rejection.currentValue)}
      </FieldDescription>

      <FieldControl
        rejection={rejection}
        value={value}
        onChange={onChange}
        config={config}
      />

      {config.description ? (
        <FieldDescription>{config.description}</FieldDescription>
      ) : null}
    </Field>
  )
}

function FieldControl({
  rejection,
  value,
  onChange,
  config,
}: {
  rejection: ResubmissionRejection
  value: string
  onChange: (value: string) => void
  config: FieldConfig
}) {
  if (config.kind === 'textarea') {
    return (
      <Textarea
        id={rejection.fieldName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
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
            data-empty={!value}
            className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
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
        <SelectTrigger id={rejection.fieldName} className="w-full">
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
      required
    />
  )
}

function DocumentsSection({
  rejections,
  fileValues,
  onFileChange,
}: {
  rejections: Array<ResubmissionRejection>
  fileValues: Record<string, File | null>
  onFileChange: (fieldName: string, file: File | null) => void
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
        {rejections.map((rejection) => (
          <div key={rejection.fieldName} className="flex flex-col gap-3">
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>{rejection.label}</AlertTitle>
              <AlertDescription>
                {rejection.remarks ?? 'Please upload an updated document.'}
              </AlertDescription>
            </Alert>

            {rejection.currentDocumentName ? (
              <FieldDescription>
                Current file: {rejection.currentDocumentName}
              </FieldDescription>
            ) : null}

            <DocumentUploadField
              name={rejection.fieldName}
              label={rejection.label}
              required
              file={fileValues[rejection.fieldName] ?? null}
              onFileChange={(file) => onFileChange(rejection.fieldName, file)}
            />
          </div>
        ))}
      </div>
    </div>
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
