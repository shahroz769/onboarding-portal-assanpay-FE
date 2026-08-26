import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Mail,
  User,
  Building2,
  Briefcase,
  CreditCard,
  Users,
  FileText,
  Info,
  CalendarIcon,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Spinner } from '#/components/ui/spinner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { SectionIcon } from '#/components/section-icon'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Calendar } from '#/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#/components/ui/combobox'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Separator } from '#/components/ui/separator'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'

import {
  merchantOnboardingSchema,
  WEBSITE_CMS_OPTIONS,
  MERCHANT_TYPES,
  KIN_RELATIONS,
  BANK_NAMES,
  BASE_DOCUMENTS,
  MERCHANT_SPECIFIC_DOCUMENTS,
  DOCUMENT_LABELS,
  ALLOWED_EXTENSIONS,
} from '#/schemas/merchant-onboarding.schema'
import { useSubmitMerchantOnboardingMutation } from '#/apis/merchant-onboarding'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import type {
  DocumentFieldName,
  MerchantOnboardingFormValues,
} from '#/schemas/merchant-onboarding.schema'
import type { MerchantSubmissionResponse } from '#/apis/merchant-onboarding'
import { DocumentUploadField } from './document-upload-field'
import { OnboardingSectionNav } from './onboarding-section-nav'
import type { OnboardingNavSection } from './onboarding-section-nav'
import type { StatusTint } from '#/lib/status-styles'
import { SubmissionSuccess } from './submission-success'

// ── Sections & draft autosave ───────────────────────────────────────────────

const DRAFT_STORAGE_KEY = 'assanpay:merchant-onboarding-draft'
const DRAFT_STORAGE_VERSION = 1

type VersionedOnboardingDraft = {
  v: number
  values: Record<string, string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pickPersistedDraftValues(
  values: MerchantOnboardingFormValues,
): Record<string, string> {
  const persisted: Record<string, string> = {}

  for (const [key, val] of Object.entries(values)) {
    if (typeof val === 'string' && val.trim() !== '') {
      persisted[key] = val
    }
  }

  return persisted
}

function readOnboardingDraftValues(): Record<string, string> | null {
  const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
  if (!raw) return null

  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed)) return null

  if (parsed.v === DRAFT_STORAGE_VERSION && isRecord(parsed.values)) {
    return Object.fromEntries(
      Object.entries(parsed.values).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  }

  if (typeof parsed.v === 'number') {
    return null
  }

  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

function writeOnboardingDraftValues(values: MerchantOnboardingFormValues) {
  const persisted = pickPersistedDraftValues(values)
  if (Object.keys(persisted).length === 0) {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    return
  }

  const payload: VersionedOnboardingDraft = {
    v: DRAFT_STORAGE_VERSION,
    values: persisted,
  }
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload))
}

function createDebouncedTask(task: () => void, delay: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined

  return {
    schedule() {
      clearTimeout(timeout)
      timeout = setTimeout(task, delay)
    },
    cancel() {
      clearTimeout(timeout)
    },
  }
}

// Order and ids must match the rendered <Card id="..."> anchors below.
const FORM_SECTIONS = [
  {
    id: 'submitter',
    label: 'Submitter',
    tone: 'blue',
    fields: ['email', 'activeWhatsappNumber'],
  },
  {
    id: 'business',
    label: 'Business',
    tone: 'violet',
    fields: [
      'businessName',
      'businessPhone',
      'businessEmail',
      'businessWebsite',
      'businessAddress',
      'websiteCms',
      'businessDescription',
      'businessRegistrationDate',
      'businessNature',
    ],
  },
  {
    id: 'classification',
    label: 'Classification',
    tone: 'teal',
    fields: [
      'merchantType',
      'estimatedMonthlyTransactions',
      'estimatedMonthlyVolume',
    ],
  },
  {
    id: 'financial',
    label: 'Financial',
    tone: 'green',
    fields: ['accountTitle', 'bankName', 'branchName', 'accountNumberIban'],
  },
  {
    id: 'owner',
    label: 'Owner',
    tone: 'amber',
    fields: ['ownerFullName', 'ownerPhone'],
  },
  {
    id: 'kin',
    label: 'Next of kin',
    tone: 'rose',
    fields: ['nextOfKinRelation'],
  },
  { id: 'documents', label: 'Documents', tone: 'orange', fields: [] },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  tone: StatusTint
  fields: ReadonlyArray<keyof MerchantOnboardingFormValues>
}>

// ── Main Form ───────────────────────────────────────────────────────────────

type MerchantOnboardingFormProps = {
  onSubmittedChange?: (submitted: boolean) => void
}

function showValidationErrorsToast(errors: Iterable<unknown>) {
  const hasErrors = Array.from(errors).some(Boolean)
  toast.error(
    hasErrors
      ? 'Please review the highlighted fields and try again.'
      : 'Something went wrong. Please try again.',
  )
}

function hasNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() !== ''
}

function getNumericInputValue(value: string, allowDecimal: boolean) {
  if (!allowDecimal) {
    return value.replace(/\D/g, '')
  }

  const sanitizedValue = value.replace(/[^\d.]/g, '')
  const [integerPart = '', ...decimalParts] = sanitizedValue.split('.')
  const decimalPart = decimalParts.join('').slice(0, 2)

  if (!sanitizedValue.includes('.')) {
    return integerPart
  }

  return `${integerPart}.${decimalPart}`
}

function handleNumericKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  allowDecimal: boolean,
) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return
  }

  const allowedKeys = new Set([
    'Backspace',
    'Delete',
    'Tab',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
  ])

  if (allowedKeys.has(event.key)) {
    return
  }

  if (allowDecimal && event.key === '.') {
    if (event.currentTarget.value.includes('.')) {
      event.preventDefault()
    }
    return
  }

  if (!/^\d$/.test(event.key)) {
    event.preventDefault()
  }
}

export function MerchantOnboardingForm({
  onSubmittedChange,
}: MerchantOnboardingFormProps) {
  const [submissionData, setSubmissionData] =
    useState<MerchantSubmissionResponse | null>(null)
  const [documents, setDocuments] = useState<
    Partial<Record<DocumentFieldName, File>>
  >({})
  const [documentErrors, setDocumentErrors] = useState<
    Partial<Record<DocumentFieldName, string>>
  >({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const submitMerchantOnboardingMutation = useSubmitMerchantOnboardingMutation()

  const form = useForm({
    defaultValues: {
      email: '',
      ownerFullName: '',
      ownerPhone: '',
      activeWhatsappNumber: '',
      businessName: '',
      businessPhone: '',
      businessEmail: '',
      businessAddress: '',
      businessWebsite: '',
      websiteCms: '',
      businessDescription: '',
      businessRegistrationDate: '',
      businessNature: '',
      merchantType: '',
      estimatedMonthlyTransactions: '',
      estimatedMonthlyVolume: '',
      accountTitle: '',
      bankName: '',
      branchName: '',
      accountNumberIban: '',
      swiftCode: '',
      nextOfKinRelation: '',
    } satisfies Record<keyof MerchantOnboardingFormValues, string>,
    validators: {
      onSubmit: merchantOnboardingSchema,
    },
    onSubmitInvalid: ({ formApi }) => {
      setSubmissionError(null)
      const fieldErrors = Object.values(formApi.state.fieldMeta).flatMap(
        (fieldMeta) => fieldMeta.errors,
      )

      showValidationErrorsToast([...fieldErrors, ...formApi.state.errors])

      if (typeof document === 'undefined') {
        return
      }

      const firstInvalidElement = document.querySelector<HTMLElement>(
        '[aria-invalid="true"]',
      )
      firstInvalidElement?.focus()
    },
    onSubmit: async ({ value }) => {
      setSubmissionError(null)

      // Validate documents
      const docErrors = validateDocuments(value.merchantType)
      if (Object.keys(docErrors).length > 0) {
        setDocumentErrors(docErrors)
        showValidationErrorsToast(Object.values(docErrors))
        return
      }
      setDocumentErrors({})

      // Build FormData
      const formData = new FormData()
      for (const [key, val] of Object.entries(value)) {
        formData.append(key, val)
      }
      for (const [key, file] of Object.entries(documents) as Array<
        [DocumentFieldName, File | undefined]
      >) {
        if (file) {
          formData.append(key, file)
        }
      }

      try {
        const response =
          await submitMerchantOnboardingMutation.mutateAsync(formData)
        window.localStorage.removeItem(DRAFT_STORAGE_KEY)
        setSubmissionData(response)
        onSubmittedChange?.(true)
        toast.success('Form submitted successfully!')
      } catch (error: unknown) {
        const message = getApiErrorMessage(
          error,
          'Unable to submit the application. Please try again.',
        )
        setSubmissionError(message)
        toast.error(message)
      }
    },
  })

  const merchantType = useStore(form.store, (s) => s.values.merchantType)
  const nextOfKinRelation = useStore(
    form.store,
    (s) => s.values.nextOfKinRelation,
  )
  const submissionAttempts = useStore(form.store, (s) => s.submissionAttempts)

  // Per-section completion (primitive selectors → rerender only on flips)
  const submitterComplete = useStore(form.store, (s) =>
    FORM_SECTIONS[0].fields.every((name) => hasNonEmptyString(s.values[name])),
  )
  const businessComplete = useStore(form.store, (s) =>
    FORM_SECTIONS[1].fields.every((name) => hasNonEmptyString(s.values[name])),
  )
  const classificationComplete = useStore(form.store, (s) =>
    FORM_SECTIONS[2].fields.every((name) => hasNonEmptyString(s.values[name])),
  )
  const financialComplete = useStore(form.store, (s) =>
    FORM_SECTIONS[3].fields.every((name) => hasNonEmptyString(s.values[name])),
  )
  const ownerComplete = useStore(form.store, (s) =>
    FORM_SECTIONS[4].fields.every((name) => hasNonEmptyString(s.values[name])),
  )
  const kinComplete = useStore(form.store, (s) =>
    FORM_SECTIONS[5].fields.every((name) => hasNonEmptyString(s.values[name])),
  )

  const specificDocs = merchantType
    ? MERCHANT_SPECIFIC_DOCUMENTS[
        merchantType as keyof typeof MERCHANT_SPECIFIC_DOCUMENTS
      ]
    : null
  const documentsComplete =
    BASE_DOCUMENTS.every((doc) => Boolean(documents[doc])) &&
    (specificDocs?.required ?? []).every((doc) => Boolean(documents[doc]))

  // ── Draft autosave ─────────────────────────────────────────────────────
  // Text fields persist to this device's localStorage; files can't be
  // persisted, so the restore toast tells the user to re-attach documents.
  // StrictMode re-runs effects; the ref guarantees one restore + one toast.
  const didRestoreDraftRef = useRef(false)
  useEffect(() => {
    if (didRestoreDraftRef.current) return
    didRestoreDraftRef.current = true
    try {
      const draftValues = readOnboardingDraftValues()
      if (!draftValues) return
      let restoredCount = 0
      for (const [key, val] of Object.entries(draftValues)) {
        if (val !== '' && key in form.state.values) {
          form.setFieldValue(key as keyof MerchantOnboardingFormValues, val)
          restoredCount += 1
        }
      }
      if (restoredCount > 0) {
        toast.info('Your draft was restored from this device.', {
          description: 'Documents are not saved — re-attach them below.',
        })
      }
    } catch {
      // Unavailable or corrupted storage — start fresh.
    }
  }, [form])

  useEffect(() => {
    const draftSave = createDebouncedTask(() => {
      try {
        writeOnboardingDraftValues(form.state.values)
      } catch {
        // Storage full or blocked (private mode) — skip autosave.
      }
    }, 400)
    const subscription = form.store.subscribe(() => draftSave.schedule())

    return () => {
      draftSave.cancel()
      subscription.unsubscribe()
    }
  }, [form])

  const getDocLabel = (doc: DocumentFieldName): string => {
    const label = DOCUMENT_LABELS[doc]
    if (
      (doc === 'next_of_kin_cnic_front' || doc === 'next_of_kin_cnic_back') &&
      nextOfKinRelation
    ) {
      const relationLabel = KIN_RELATIONS.find(
        (r) => r.value === nextOfKinRelation,
      )?.label
      if (relationLabel) {
        return label.replace('Next Of Kin', `${relationLabel}'s`)
      }
    }
    return label
  }

  const validateDocuments = (type: string): Record<string, string> => {
    const errors: Record<string, string> = {}

    // Base documents are always required
    for (const doc of BASE_DOCUMENTS) {
      if (!documents[doc]) {
        errors[doc] = `${DOCUMENT_LABELS[doc]} is required.`
      }
    }

    // Merchant-type specific required documents
    if (type && type in MERCHANT_SPECIFIC_DOCUMENTS) {
      const specific =
        MERCHANT_SPECIFIC_DOCUMENTS[
          type as keyof typeof MERCHANT_SPECIFIC_DOCUMENTS
        ]

      for (const doc of specific.required) {
        if (!documents[doc]) {
          errors[doc] = `${DOCUMENT_LABELS[doc]} is required.`
        }
      }
    }

    return errors
  }

  const resetFormState = () => {
    form.reset()
    setDocuments({})
    setDocumentErrors({})
    setSubmissionError(null)
    setSubmissionData(null)
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    onSubmittedChange?.(false)
  }

  const handleDocumentChange = (name: DocumentFieldName, file: File | null) => {
    setDocuments((prev) => {
      const next = { ...prev }
      if (file) {
        next[name] = file
      } else {
        delete next[name]
      }
      return next
    })
    // Clear error for this document when a file is selected
    if (file) {
      setDocumentErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleDocumentValidationError = (
    name: DocumentFieldName,
    message: string,
  ) => {
    setDocumentErrors((prev) => ({
      ...prev,
      [name]: message,
    }))
    toast.error(message)
  }

  const getIsInvalid = (field: {
    state: {
      meta: {
        isTouched: boolean
        isValid: boolean
      }
    }
  }) => {
    return (
      (field.state.meta.isTouched || submissionAttempts > 0) &&
      !field.state.meta.isValid
    )
  }

  // ── Success View ────────────────────────────────────────────────────────

  if (submissionData) {
    return (
      <SubmissionSuccess
        data={submissionData}
        onNewSubmission={resetFormState}
      />
    )
  }

  // ── Section nav model ───────────────────────────────────────────────────

  const sectionCompletion = [
    submitterComplete,
    businessComplete,
    classificationComplete,
    financialComplete,
    ownerComplete,
    kinComplete,
    documentsComplete,
  ]
  const navSections: OnboardingNavSection[] = FORM_SECTIONS.map(
    ({ id, label, tone }, index) => ({
      id,
      label,
      tone,
      complete: sectionCompletion[index] ?? false,
    }),
  )

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-6"
    >
      <OnboardingSectionNav sections={navSections} />

      {/* Section 1: Submitter Information */}
      <Card id="submitter" className="scroll-mt-28">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon icon={Mail} tone="blue" />

            <div>
              <CardTitle>Submitter Information</CardTitle>
              <CardDescription>
                Email address of the person submitting this form
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-6 sm:grid-cols-2">
            <form.Field name="email">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Submitter Email *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="email@example.com"
                      autoComplete="email"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="activeWhatsappNumber">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Active WhatsApp Number *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="tel"
                      inputMode="numeric"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(
                          getNumericInputValue(event.target.value, false).slice(
                            0,
                            11,
                          ),
                        )
                      }
                      onKeyDown={(event) => handleNumericKeyDown(event, false)}
                      aria-invalid={isInvalid}
                      placeholder="03XXXXXXXXX"
                      autoComplete="tel"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Section 2: Business Information */}
      <Card id="business" className="scroll-mt-28">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon icon={Building2} tone="violet" />

            <div>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Basic business and contact details
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <form.Field name="businessName">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Business Name *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Enter business name"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="businessPhone">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Business Phone Number *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="tel"
                      inputMode="numeric"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(
                          getNumericInputValue(event.target.value, false),
                        )
                      }
                      onKeyDown={(event) => handleNumericKeyDown(event, false)}
                      aria-invalid={isInvalid}
                      placeholder="Enter business phone"
                      autoComplete="tel"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="businessEmail">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Business Email *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="business@example.com"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="businessWebsite">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Business Website *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="url"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="https://example.com"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="businessAddress">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid} className="sm:col-span-2">
                    <FieldLabel htmlFor={field.name}>
                      Business Address *
                    </FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Enter full business address"
                      className="min-h-20"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="websiteCms">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Website Platform / CMS *
                    </FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger
                        id={field.name}
                        aria-invalid={isInvalid}
                        className="w-full"
                      >
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {WEBSITE_CMS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="businessNature">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Nature of Business *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="e.g. E-commerce, SaaS, Retail"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="businessRegistrationDate">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                const selectedDate = field.state.value
                  ? new Date(field.state.value + 'T00:00:00')
                  : undefined
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>Business Registration Date *</FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          data-empty={!field.state.value}
                          aria-invalid={isInvalid}
                          className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
                          onBlur={field.handleBlur}
                        >
                          <CalendarIcon data-icon="inline-start" />
                          {selectedDate
                            ? format(selectedDate, 'PPP')
                            : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            field.handleChange(
                              date ? format(date, 'yyyy-MM-dd') : '',
                            )
                          }}
                          disabled={(date) => date > new Date()}
                          captionLayout="dropdown"
                          defaultMonth={selectedDate}
                        />
                      </PopoverContent>
                    </Popover>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="businessDescription">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid} className="sm:col-span-2">
                    <FieldLabel htmlFor={field.name}>
                      Business Description *
                    </FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Describe what your business does"
                      className="min-h-20"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Business Classification */}
      <Card id="classification" className="scroll-mt-28">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon icon={Briefcase} tone="teal" />

            <div>
              <CardTitle>Business Classification</CardTitle>
              <CardDescription>
                Business type and transaction estimates
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <form.Field name="merchantType">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid} className="sm:col-span-2">
                    <FieldLabel htmlFor={field.name}>
                      Business Type *
                    </FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger
                        id={field.name}
                        aria-invalid={isInvalid}
                        className="w-full"
                      >
                        <SelectValue placeholder="Select business type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {MERCHANT_TYPES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      This determines which documents are required below.
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="estimatedMonthlyTransactions">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Estimated Monthly Transactions *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      inputMode="numeric"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(
                          getNumericInputValue(e.target.value, false),
                        )
                      }
                      onKeyDown={(event) => handleNumericKeyDown(event, false)}
                      aria-invalid={isInvalid}
                      placeholder="e.g. 500"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="estimatedMonthlyVolume">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Estimated Monthly Volume (PKR) *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      inputMode="decimal"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(
                          getNumericInputValue(e.target.value, true),
                        )
                      }
                      onKeyDown={(event) => handleNumericKeyDown(event, true)}
                      aria-invalid={isInvalid}
                      placeholder="e.g. 1000000"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Financial Information */}
      <Card id="financial" className="scroll-mt-28">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon icon={CreditCard} tone="green" />

            <div>
              <CardTitle>Financial Information</CardTitle>
              <CardDescription>
                Bank account and settlement details
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <form.Field name="accountTitle">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Account Title *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Enter account title"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="bankName">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>Bank Name *</FieldLabel>
                    <Combobox
                      items={BANK_NAMES as unknown as string[]}
                      value={field.state.value || null}
                      onValueChange={(value) => field.handleChange(value ?? '')}
                    >
                      <ComboboxInput
                        placeholder="Search bank..."
                        aria-invalid={isInvalid}
                        className="w-full"
                        onBlur={field.handleBlur}
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
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="branchName">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Branch Name *</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Enter branch name"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="accountNumberIban">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Account Number / IBAN *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Enter account number or IBAN"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="swiftCode">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>SWIFT Code</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Optional"
                    />

                    <FieldDescription>
                      Required only for international transfers.
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Director/CEO/Owner Information */}
      <Card id="owner" className="scroll-mt-28">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon icon={User} tone="amber" />

            <div>
              <CardTitle>Director/CEO/Owner Information</CardTitle>
              <CardDescription>
                Details of the Director, CEO, or owner
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <form.Field name="ownerFullName">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Full Name *</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Enter full name"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="ownerPhone">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Phone Number *</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="tel"
                      inputMode="numeric"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(
                          getNumericInputValue(event.target.value, false).slice(
                            0,
                            11,
                          ),
                        )
                      }
                      onKeyDown={(event) => handleNumericKeyDown(event, false)}
                      aria-invalid={isInvalid}
                      placeholder="03XXXXXXXXX"
                      autoComplete="tel"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Next of Kin */}
      <Card id="kin" className="scroll-mt-28">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon icon={Users} tone="rose" />

            <div>
              <CardTitle>Next of Kin</CardTitle>
              <CardDescription>Emergency contact relationship</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.Field name="nextOfKinRelation">
              {(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Next of Kin Relation *
                    </FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger
                        id={field.name}
                        aria-invalid={isInvalid}
                        className="w-full"
                      >
                        <SelectValue placeholder="Select relation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {KIN_RELATIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Section 7: Documents */}
      <Card id="documents" className="scroll-mt-28">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon icon={FileText} tone="orange" />

            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Upload required documents for verification
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <Alert>
              <Info className="size-4" />
              <AlertDescription>
                Accepted formats: {ALLOWED_EXTENSIONS.join(', ')}. Maximum file
                size: 10 MB per document.
              </AlertDescription>
            </Alert>

            {/* Base Documents — Always Required */}
            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                {BASE_DOCUMENTS.map((doc) => (
                  <DocumentUploadField
                    key={doc}
                    name={doc}
                    label={getDocLabel(doc)}
                    required
                    file={documents[doc] ?? null}
                    onFileChange={(file) => handleDocumentChange(doc, file)}
                    onValidationError={(message) =>
                      handleDocumentValidationError(doc, message)
                    }
                    error={documentErrors[doc]}
                  />
                ))}
              </div>
            </div>

            {/* Business-Type Specific Documents */}
            {merchantType && specificDocs && (
              <>
                <Separator />

                {/* Required for this business type */}
                {specificDocs.required.length > 0 && (
                  <div>
                    <h3 className="mb-4 text-sm font-semibold">
                      Required for{' '}
                      {
                        MERCHANT_TYPES.find((t) => t.value === merchantType)
                          ?.label
                      }
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {specificDocs.required.map((doc) => (
                        <DocumentUploadField
                          key={doc}
                          name={doc}
                          label={getDocLabel(doc)}
                          required
                          file={documents[doc] ?? null}
                          onFileChange={(file) =>
                            handleDocumentChange(doc, file)
                          }
                          onValidationError={(message) =>
                            handleDocumentValidationError(doc, message)
                          }
                          error={documentErrors[doc]}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional for this business type */}
                {specificDocs.optional.length > 0 && (
                  <div>
                    <h3 className="mb-4 text-sm font-semibold">
                      Optional Documents
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {specificDocs.optional.map((doc) => (
                        <DocumentUploadField
                          key={doc}
                          name={doc}
                          label={getDocLabel(doc)}
                          file={documents[doc] ?? null}
                          onFileChange={(file) =>
                            handleDocumentChange(doc, file)
                          }
                          onValidationError={(message) =>
                            handleDocumentValidationError(doc, message)
                          }
                          error={documentErrors[doc]}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!merchantType && (
              <p className="text-sm text-muted-foreground">
                Select a business type above to see additional document
                requirements.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      {submissionError ? (
        <Alert variant="destructive">
          <AlertDescription>{submissionError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={resetFormState}>
          Reset
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}
