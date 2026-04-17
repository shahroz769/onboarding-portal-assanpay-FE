import { useState, useCallback } from "react"
import type { ComponentType, KeyboardEvent, SVGProps } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import { format } from "date-fns"
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
} from "lucide-react"

import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { Textarea } from "#/components/ui/textarea"
import { Spinner } from "#/components/ui/spinner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import { Calendar } from "#/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "#/components/ui/popover"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "#/components/ui/combobox"
import { Alert, AlertDescription } from "#/components/ui/alert"
import { Separator } from "#/components/ui/separator"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "#/components/ui/field"

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
} from "#/schemas/merchant-onboarding.schema"
import { useSubmitMerchantOnboardingMutation } from "#/apis/merchant-onboarding"
import type {
  DocumentFieldName,
  MerchantOnboardingFormValues,
} from "#/schemas/merchant-onboarding.schema"
import type { MerchantSubmissionResponse } from "#/apis/merchant-onboarding"
import { DocumentUploadField } from "./document-upload-field"
import { SubmissionSuccess } from "./submission-success"

// ── Section Header ──────────────────────────────────────────────────────────

function SectionIcon({
  icon: Icon,
  colorClass,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
}) {
  return (
    <div
      className={`flex size-10 items-center justify-center rounded-lg ${colorClass}`}
    >
      <Icon className="size-5" />
    </div>
  )
}

// ── Main Form ───────────────────────────────────────────────────────────────

type MerchantOnboardingFormProps = {
  onSubmittedChange?: (submitted: boolean) => void
}

function showValidationErrorsToast(errors: Iterable<unknown>) {
  const hasErrors = Array.from(errors).some(Boolean)
  toast.error(
    hasErrors
      ? "Please review the highlighted fields and try again."
      : "Something went wrong. Please try again."
  )
}

function getNumericInputValue(value: string, allowDecimal: boolean) {
  if (!allowDecimal) {
    return value.replace(/\D/g, "")
  }

  const sanitizedValue = value.replace(/[^\d.]/g, "")
  const [integerPart = "", ...decimalParts] = sanitizedValue.split(".")
  const decimalPart = decimalParts.join("").slice(0, 2)

  if (!sanitizedValue.includes(".")) {
    return integerPart
  }

  return `${integerPart}.${decimalPart}`
}

function handleNumericKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  allowDecimal: boolean
) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return
  }

  const allowedKeys = new Set([
    "Backspace",
    "Delete",
    "Tab",
    "Enter",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
  ])

  if (allowedKeys.has(event.key)) {
    return
  }

  if (allowDecimal && event.key === ".") {
    if (event.currentTarget.value.includes(".")) {
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
  const submitMerchantOnboardingMutation = useSubmitMerchantOnboardingMutation()

  const form = useForm({
    defaultValues: {
      email: "",
      ownerFullName: "",
      ownerPhone: "",
      businessName: "",
      businessPhone: "",
      businessEmail: "",
      businessAddress: "",
      businessWebsite: "",
      websiteCms: "",
      businessDescription: "",
      businessRegistrationDate: "",
      businessNature: "",
      merchantType: "",
      estimatedMonthlyTransactions: "",
      estimatedMonthlyVolume: "",
      accountTitle: "",
      bankName: "",
      branchName: "",
      accountNumberIban: "",
      swiftCode: "",
      nextOfKinRelation: "",
    } satisfies Record<keyof MerchantOnboardingFormValues, string>,
    validators: {
      onSubmit: merchantOnboardingSchema,
    },
    onSubmitInvalid: ({ formApi }) => {
      const fieldErrors = Object.values(formApi.state.fieldMeta).flatMap(
        (fieldMeta) => fieldMeta.errors
      )

      showValidationErrorsToast([...fieldErrors, ...formApi.state.errors])

      if (typeof document === "undefined") {
        return
      }

      const firstInvalidElement = document.querySelector<HTMLElement>(
        '[aria-invalid="true"]'
      )
      firstInvalidElement?.focus()
    },
    onSubmit: async ({ value }) => {
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
        setSubmissionData(response)
        onSubmittedChange?.(true)
        toast.success("Form submitted successfully!")
      } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.data) {
          const data = error.response.data as {
            message?: string
            errors?: Partial<Record<DocumentFieldName, string>>
          }
          toast.error(data.message ?? "Submission failed. Please try again.")
        } else {
          toast.error("An unexpected error occurred. Please try again.")
        }
      }
    },
  })

  const merchantType = useStore(form.store, (s) => s.values.merchantType)
  const nextOfKinRelation = useStore(
    form.store,
    (s) => s.values.nextOfKinRelation
  )
  const submissionAttempts = useStore(form.store, (s) => s.submissionAttempts)

  const getDocLabel = useCallback(
    (doc: DocumentFieldName): string => {
      const label = DOCUMENT_LABELS[doc]
      if (
        (doc === "next_of_kin_cnic_front" || doc === "next_of_kin_cnic_back") &&
        nextOfKinRelation
      ) {
        const relationLabel = KIN_RELATIONS.find(
          (r) => r.value === nextOfKinRelation
        )?.label
        if (relationLabel) {
          return label.replace("Next Of Kin", `${relationLabel}'s`)
        }
      }
      return label
    },
    [nextOfKinRelation]
  )

  const validateDocuments = useCallback(
    (type: string): Record<string, string> => {
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
    },
    [documents]
  )

  const handleDocumentChange = useCallback(
    (name: DocumentFieldName, file: File | null) => {
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
    },
    []
  )

  const handleDocumentValidationError = useCallback(
    (name: DocumentFieldName, message: string) => {
      setDocumentErrors((prev) => ({
        ...prev,
        [name]: message,
      }))
      toast.error(message)
    },
    []
  )

  const getIsInvalid = useCallback(
    (field: {
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
    },
    [submissionAttempts]
  )

  // ── Success View ────────────────────────────────────────────────────────

  if (submissionData) {
    return <SubmissionSuccess data={submissionData} />
  }

  // ── Merchant-type specific docs ─────────────────────────────────────────

  const specificDocs = merchantType
    ? MERCHANT_SPECIFIC_DOCUMENTS[
        merchantType as keyof typeof MERCHANT_SPECIFIC_DOCUMENTS
      ]
    : null

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
      {/* Section 1: Submitter Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon
              icon={Mail}
              colorClass="bg-blue-500/10 text-blue-500"
            />
            <div>
              <CardTitle>Submitter Information</CardTitle>
              <CardDescription>
                Email address of the person submitting this form
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.Field
              name="email"
              children={(field) => {
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
            />
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Section 2: Owner Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon
              icon={User}
              colorClass="bg-amber-500/10 text-amber-500"
            />
            <div>
              <CardTitle>Owner Information</CardTitle>
              <CardDescription>
                Details of the business owner
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <form.Field
              name="ownerFullName"
              children={(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Owner Full Name *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Enter owner's full name"
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="ownerPhone"
              children={(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Owner Phone Number *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Enter phone number"
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Business Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon
              icon={Building2}
              colorClass="bg-violet-500/10 text-violet-500"
            />
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
            <form.Field
              name="businessName"
              children={(field) => {
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
            />

            <form.Field
              name="businessPhone"
              children={(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Business Phone Number *
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Enter business phone"
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="businessEmail"
              children={(field) => {
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
            />

            <form.Field
              name="businessWebsite"
              children={(field) => {
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
            />

            <form.Field
              name="businessAddress"
              children={(field) => {
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
            />

            <form.Field
              name="websiteCms"
              children={(field) => {
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
            />

            <form.Field
              name="businessNature"
              children={(field) => {
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
            />

            <form.Field
              name="businessRegistrationDate"
              children={(field) => {
                const isInvalid = getIsInvalid(field)
                const selectedDate = field.state.value
                  ? new Date(field.state.value + "T00:00:00")
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
                            ? format(selectedDate, "PPP")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            field.handleChange(
                              date
                                ? format(date, "yyyy-MM-dd")
                                : ""
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
            />

            <form.Field
              name="businessDescription"
              children={(field) => {
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
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Business Classification */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon
              icon={Briefcase}
              colorClass="bg-teal-500/10 text-teal-500"
            />
            <div>
              <CardTitle>Business Classification</CardTitle>
              <CardDescription>
                Merchant type and transaction estimates
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <form.Field
              name="merchantType"
              children={(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid} className="sm:col-span-2">
                    <FieldLabel htmlFor={field.name}>
                      Merchant Type *
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
                        <SelectValue placeholder="Select merchant type" />
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
            />

            <form.Field
              name="estimatedMonthlyTransactions"
              children={(field) => {
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
                          getNumericInputValue(e.target.value, false)
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
            />

            <form.Field
              name="estimatedMonthlyVolume"
              children={(field) => {
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
                          getNumericInputValue(e.target.value, true)
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
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Financial Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon
              icon={CreditCard}
              colorClass="bg-green-500/10 text-green-500"
            />
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
            <form.Field
              name="accountTitle"
              children={(field) => {
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
            />

            <form.Field
              name="bankName"
              children={(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>Bank Name *</FieldLabel>
                    <Combobox
                      items={BANK_NAMES as unknown as string[]}
                      value={field.state.value || null}
                      onValueChange={(val) => field.handleChange(val as string)}
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
            />

            <form.Field
              name="branchName"
              children={(field) => {
                const isInvalid = getIsInvalid(field)
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Branch Name *
                    </FieldLabel>
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
            />

            <form.Field
              name="accountNumberIban"
              children={(field) => {
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
            />

            <form.Field
              name="swiftCode"
              children={(field) => {
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
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Next of Kin */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon
              icon={Users}
              colorClass="bg-rose-500/10 text-rose-500"
            />
            <div>
              <CardTitle>Next of Kin</CardTitle>
              <CardDescription>
                Emergency contact relationship
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.Field
              name="nextOfKinRelation"
              children={(field) => {
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
            />
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Section 7: Documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon
              icon={FileText}
              colorClass="bg-orange-500/10 text-orange-500"
            />
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
                Accepted formats: {ALLOWED_EXTENSIONS.join(", ")}. Maximum file
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

            {/* Merchant-Type Specific Documents */}
            {merchantType && specificDocs && (
              <>
                <Separator />

                {/* Required for this merchant type */}
                {specificDocs.required.length > 0 && (
                  <div>
                    <h3 className="mb-4 text-sm font-semibold">
                      Required for{" "}
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

                {/* Optional for this merchant type */}
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
                Select a merchant type above to see additional document
                requirements.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.reset()
            setDocuments({})
            setDocumentErrors({})
          }}
        >
          Reset
        </Button>
        <form.Subscribe
          selector={(state) => state.isSubmitting}
          children={(isSubmitting) => (
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
          )}
        />
      </div>
    </form>
  )
}

