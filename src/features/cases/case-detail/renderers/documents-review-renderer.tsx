import { useMemo, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import {
  Building2,
  Briefcase,
  CalendarIcon,
  CreditCard,
  FileText,
  Info,
  Mail,
  ExternalLink,
  User,
  Users,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/features/auth/auth-client'
import { useSaveFieldReviews } from '#/hooks/use-case-detail-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'
import {
  BASE_DOCUMENTS,
  DOCUMENT_LABELS,
  KIN_RELATIONS,
  MERCHANT_SPECIFIC_DOCUMENTS,
  MERCHANT_TYPES,
  WEBSITE_CMS_OPTIONS,
} from '#/schemas/merchant-onboarding.schema'
import type { FieldReview, FieldReviewStatus } from '#/schemas/cases.schema'

import type { QueueRendererProps } from '../queue-registry'
import { useDocumentsReviewDraft } from './documents-review-draft-context'

type LocalReview = {
  status: FieldReviewStatus
  remarks: string
}

type FieldKind = 'input' | 'textarea' | 'date'

type ReviewField = {
  key: string
  label: string
  kind?: FieldKind
  className?: string
  resolveValue?: (value: unknown) => string
}

type ReviewSection = {
  title: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  toneClass: string
  layout: 'single' | 'two-column'
  fields: ReviewField[]
}

type ReviewItem = {
  key: string
  label: string
  displayValue: string
  kind: FieldKind
  className?: string
}

type ReviewDocument = {
  key: string
  label: string
  url: string
  name: string
  sizeBytes: number | null
  mimeType: string | null
  isRequired: boolean
}

type MerchantDocument = {
  id: string
  originalName?: string | null
  googleDriveWebViewLink?: string | null
  documentType?: string | null
  sizeBytes?: number | null
  mimeType?: string | null
}

const CMS_LABELS = new Map(
  WEBSITE_CMS_OPTIONS.map((option) => [option.value, option.label]),
)
const MERCHANT_TYPE_LABELS = new Map(
  MERCHANT_TYPES.map((option) => [option.value, option.label]),
)
const RELATION_LABELS = new Map(
  KIN_RELATIONS.map((option) => [option.value, option.label]),
)

const REVIEW_SECTIONS: ReviewSection[] = [
  {
    title: 'Submitter Information',
    description: 'Email address of the person submitting this form',
    icon: Mail,
    toneClass: 'bg-blue-500/10 text-blue-500',
    layout: 'single',
    fields: [{ key: 'submitterEmail', label: 'Submitter Email' }],
  },
  {
    title: 'Owner Information',
    description: 'Details of the business owner',
    icon: User,
    toneClass: 'bg-amber-500/10 text-amber-500',
    layout: 'two-column',
    fields: [
      { key: 'ownerFullName', label: 'Owner Full Name' },
      { key: 'ownerPhone', label: 'Owner Phone Number' },
    ],
  },
  {
    title: 'Business Information',
    description: 'Basic business and contact details',
    icon: Building2,
    toneClass: 'bg-violet-500/10 text-violet-500',
    layout: 'two-column',
    fields: [
      { key: 'businessName', label: 'Business Name' },
      { key: 'businessPhone', label: 'Business Phone Number' },
      { key: 'businessEmail', label: 'Business Email' },
      { key: 'businessWebsite', label: 'Business Website' },
      {
        key: 'businessAddress',
        label: 'Business Address',
        kind: 'textarea',
        className: 'sm:col-span-2',
      },
      {
        key: 'websiteCms',
        label: 'Website Platform / CMS',
        resolveValue: (value) => CMS_LABELS.get(String(value)) ?? String(value),
      },
      {
        key: 'businessRegistrationDate',
        label: 'Business Registration Date',
        kind: 'date',
      },
      {
        key: 'businessDescription',
        label: 'Business Description',
        kind: 'textarea',
        className: 'sm:col-span-2',
      },
      {
        key: 'businessNature',
        label: 'Nature of Business',
      },
    ],
  },
  {
    title: 'Business Classification',
    description: 'Merchant type and transaction estimates',
    icon: Briefcase,
    toneClass: 'bg-teal-500/10 text-teal-500',
    layout: 'two-column',
    fields: [
      {
        key: 'merchantType',
        label: 'Merchant Type',
        className: 'sm:col-span-2',
        resolveValue: (value) =>
          MERCHANT_TYPE_LABELS.get(String(value)) ?? String(value),
      },
      {
        key: 'estimatedMonthlyTransactions',
        label: 'Estimated Monthly Transactions',
      },
      { key: 'estimatedMonthlyVolume', label: 'Estimated Monthly Volume (PKR)' },
    ],
  },
  {
    title: 'Financial Information',
    description: 'Bank account and settlement details',
    icon: CreditCard,
    toneClass: 'bg-green-500/10 text-green-500',
    layout: 'two-column',
    fields: [
      { key: 'accountTitle', label: 'Account Title' },
      { key: 'bankName', label: 'Bank Name' },
      { key: 'branchName', label: 'Branch Name' },
      { key: 'accountNumberIban', label: 'Account Number / IBAN' },
      { key: 'swiftCode', label: 'SWIFT Code' },
    ],
  },
  {
    title: 'Next of Kin',
    description: 'Emergency contact relationship',
    icon: Users,
    toneClass: 'bg-rose-500/10 text-rose-500',
    layout: 'single',
    fields: [
      {
        key: 'nextOfKinRelation',
        label: 'Next of Kin Relation',
        resolveValue: (value) =>
          RELATION_LABELS.get(String(value)) ?? String(value),
      },
    ],
  },
]

function formatDisplayValue(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function formatDateValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
  }).format(date)
}

function SectionIcon({
  icon: Icon,
  toneClass,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  toneClass: string
}) {
  return (
    <div
      className={cn(
        'flex size-10 items-center justify-center rounded-lg',
        toneClass,
      )}
    >
      <Icon className="size-5" />
    </div>
  )
}

export default function DocumentsReviewRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const saveFieldReviews = useSaveFieldReviews(caseId)
  const { merchant, fieldReviews, currentStage } = caseDetail
  const { draftReviews, saveRejectedReview } = useDocumentsReviewDraft()
  const isCaseOwner = Boolean(caseDetail.owner && user?.id === caseDetail.owner.id)
  const isEditable =
    isCaseOwner &&
    (
      currentStage?.category === 'in_progress' ||
      (currentStage == null && caseDetail.case.closeOutcome == null)
    )
  const merchantData = merchant as Record<string, unknown>

  const persistedReviewByField = useMemo(() => {
    const map = new Map<string, (typeof fieldReviews)[number]>()
    for (const review of fieldReviews) {
      map.set(review.fieldName, review)
    }
    return map
  }, [fieldReviews])

  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean
    item: { key: string; label: string } | null
    remarks: string
    error: string | null
  }>({
    open: false,
    item: null,
    remarks: '',
    error: null,
  })

  const sections = useMemo(() => {
    return REVIEW_SECTIONS.map((section) => {
      const items = section.fields
        .map<ReviewItem | null>((field) => {
          const rawValue = merchantData[field.key]
          const resolvedValue = field.resolveValue
            ? field.resolveValue(rawValue)
            : formatDisplayValue(rawValue)

          if (!resolvedValue) return null

          return {
            key: field.key,
            label: field.label,
            displayValue:
              field.kind === 'date'
                ? formatDateValue(resolvedValue)
                : resolvedValue,
            kind: field.kind ?? 'input',
            className: field.className,
          }
        })
        .filter((item): item is ReviewItem => item !== null)

      return {
        ...section,
        items,
      }
    }).filter((section) => section.items.length > 0)
  }, [merchantData])

  const documents = useMemo<ReviewDocument[]>(() => {
    const merchantType = formatDisplayValue(merchantData.merchantType)
    const merchantSpecificDocs = merchantType
      ? MERCHANT_SPECIFIC_DOCUMENTS[
          merchantType as keyof typeof MERCHANT_SPECIFIC_DOCUMENTS
        ]
      : null
    const requiredDocs = new Set([
      ...BASE_DOCUMENTS,
      ...(merchantSpecificDocs?.required ?? []),
    ])

    return caseDetail.documents
      .map((rawDocument) => {
        const document = rawDocument as unknown as MerchantDocument
        const url = document.googleDriveWebViewLink?.trim()
        if (!url) return null

        const documentKey =
          document.documentType && document.documentType in DOCUMENT_LABELS
            ? (document.documentType as keyof typeof DOCUMENT_LABELS)
            : null

        return {
          key: `doc_${document.id}`,
          label: documentKey
            ? DOCUMENT_LABELS[documentKey]
            : document.documentType ?? document.originalName ?? 'Uploaded Document',
          url,
          name: document.originalName ?? 'Uploaded document',
          sizeBytes: document.sizeBytes ?? null,
          mimeType: document.mimeType ?? null,
          isRequired: documentKey ? requiredDocs.has(documentKey) : false,
        }
      })
      .filter((item): item is ReviewDocument => item !== null)
  }, [caseDetail.documents, merchantData.merchantType])

  function openRejectDialog(item: { key: string; label: string }) {
    const existing = draftReviews[item.key]
    setRejectDialog({
      open: true,
      item,
      remarks: existing?.remarks ?? '',
      error: null,
    })
  }

  function closeRejectDialog() {
    setRejectDialog({
      open: false,
      item: null,
      remarks: '',
      error: null,
    })
  }

  async function confirmReject() {
    const trimmedRemarks = rejectDialog.remarks.trim()
    const dialogItem = rejectDialog.item

    if (!trimmedRemarks || !dialogItem) {
      setRejectDialog((current) => ({
        ...current,
        error: 'Rejection remarks are required.',
      }))
      return
    }

    try {
      await saveFieldReviews.mutateAsync({
        reviews: [
          {
            fieldName: dialogItem.key,
            status: 'rejected',
            remarks: trimmedRemarks,
          },
        ],
      })
      saveRejectedReview(dialogItem.key, trimmedRemarks)
      closeRejectDialog()
    } catch {
      // Mutation hook already surfaces the backend error via toast.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="py-4">
        <CardContent className="px-4 py-0">
          <div className="flex flex-col gap-5">
            {sections.map((section, index) => (
              <div key={section.title} className="flex flex-col gap-4">
                {index > 0 ? <Separator /> : null}
                <div className="flex items-center gap-3">
                  <SectionIcon icon={section.icon} toneClass={section.toneClass} />
                  <div>
                    <CardTitle>{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
                <FieldGroup
                  className={cn(
                    'grid gap-4',
                    section.layout === 'two-column' && 'sm:grid-cols-2',
                  )}
                >
                  {section.items.map((item) => (
                    <ReadOnlyReviewField
                      key={item.key}
                      item={item}
                        review={draftReviews[item.key]}
                        persistedReview={persistedReviewByField.get(item.key)}
                      isEditable={isEditable}
                      onReject={() => openRejectDialog(item)}
                    />
                  ))}
                </FieldGroup>
              </div>
            ))}

            <Separator />

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <SectionIcon
                  icon={FileText}
                  toneClass="bg-orange-500/10 text-orange-500"
                />
                <div>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>
                    Uploaded documents submitted with the onboarding form.
                  </CardDescription>
                </div>
              </div>

              {documents.length > 0 ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {documents.map((document) => (
                      <ReadOnlyDocumentField
                        key={document.key}
                        document={document}
                        review={draftReviews[document.key]}
                        persistedReview={persistedReviewByField.get(document.key)}
                        isEditable={isEditable}
                        onReject={() => openRejectDialog(document)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <Alert>
                  <Info />
                  <AlertTitle>No uploaded documents</AlertTitle>
                  <AlertDescription>
                    This case currently has no document links available to review.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={rejectDialog.open} onOpenChange={(open) => !open && closeRejectDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject item</DialogTitle>
            <DialogDescription>
              Add a clear reason for rejecting {rejectDialog.item?.label ?? 'this item'}.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field data-invalid={Boolean(rejectDialog.error)}>
              <FieldLabel htmlFor="reject-remarks">Rejection remarks</FieldLabel>
              <Textarea
                id="reject-remarks"
                value={rejectDialog.remarks}
                onChange={(event) =>
                  setRejectDialog((current) => ({
                    ...current,
                    remarks: event.target.value,
                    error: null,
                  }))
                }
                aria-invalid={Boolean(rejectDialog.error)}
                placeholder="Explain what is wrong or missing."
                className="min-h-28"
              />
              <FieldDescription>
                These remarks will be shown beneath the rejected field.
              </FieldDescription>
              {rejectDialog.error ? (
                <p className="text-sm text-destructive">{rejectDialog.error}</p>
              ) : null}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRejectDialog}
              disabled={saveFieldReviews.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={saveFieldReviews.isPending}
            >
              {saveFieldReviews.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              {saveFieldReviews.isPending
                ? 'Saving rejection'
                : 'Save rejection note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function isResubmittedAfterReview(review: FieldReview | undefined) {
  if (!review?.resubmittedAt) return false
  if (!review.updatedAt) return true
  return new Date(review.resubmittedAt).getTime() >
    new Date(review.updatedAt).getTime()
}

function UpdatedBadge({ resubmittedAt }: { resubmittedAt: string }) {
  let label = 'Updated'
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
    }).format(new Date(resubmittedAt))
    label = `Updated ${formatted}`
  } catch {
    /* keep fallback label */
  }
  return (
    <Badge
      variant="secondary"
      className="border-transparent bg-blue-100 text-blue-800"
      title={label}
    >
      Updated
    </Badge>
  )
}

function ReadOnlyReviewField({
  item,
  review,
  persistedReview,
  isEditable,
  onReject,
}: {
  item: ReviewItem
  review: LocalReview | undefined
  persistedReview: FieldReview | undefined
  isEditable: boolean
  onReject: () => void
}) {
  const isRejected = review?.status === 'rejected'
  const showUpdated = isResubmittedAfterReview(persistedReview)

  return (
    <Field className={item.className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FieldLabel className="min-w-0 flex items-center gap-2">
          {item.label}
          {showUpdated && persistedReview?.resubmittedAt ? (
            <UpdatedBadge resubmittedAt={persistedReview.resubmittedAt} />
          ) : null}
        </FieldLabel>
        {isEditable ? (
          <div className="flex shrink-0 items-center gap-2">
            {isRejected ? (
              <Badge
                className="cursor-pointer border-transparent bg-red-100 text-red-800 hover:bg-red-200"
                onClick={onReject}
              >
                Rejected
              </Badge>
            ) : (
              <Badge variant="secondary" className="cursor-pointer" onClick={onReject}>
                Reject
              </Badge>
            )}
          </div>
        ) : null}
      </div>

      {item.kind === 'textarea' ? (
        <Textarea value={item.displayValue} readOnly className="min-h-20 resize-none" />
      ) : item.kind === 'date' ? (
        <Button
          variant="outline"
          type="button"
          disabled
          className="w-full justify-start text-left font-normal disabled:opacity-100"
        >
          <CalendarIcon data-icon="inline-start" />
          {item.displayValue}
        </Button>
      ) : (
        <Input value={item.displayValue} readOnly />
      )}
    </Field>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ReadOnlyDocumentField({
  document,
  review,
  persistedReview,
  isEditable,
  onReject,
}: {
  document: ReviewDocument
  review: LocalReview | undefined
  persistedReview: FieldReview | undefined
  isEditable: boolean
  onReject: () => void
}) {
  const isRejected = review?.status === 'rejected'
  const showUpdated = isResubmittedAfterReview(persistedReview)

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium">{document.label}</span>
          {showUpdated && persistedReview?.resubmittedAt ? (
            <UpdatedBadge resubmittedAt={persistedReview.resubmittedAt} />
          ) : null}
        </div>
        {isEditable ? (
          <div className="flex shrink-0 items-center gap-2">
            {isRejected ? (
              <Badge
                className="cursor-pointer border-transparent bg-red-100 text-red-800 hover:bg-red-200"
                onClick={onReject}
              >
                Rejected
              </Badge>
            ) : (
              <Badge variant="secondary" className="cursor-pointer" onClick={onReject}>
                Reject
              </Badge>
            )}
          </div>
        ) : null}
      </div>

      <a
        href={document.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-3 transition-colors hover:bg-muted/50"
      >
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
          <span className="truncate text-sm">{document.name}</span>
          <span className="text-xs text-muted-foreground">
            {document.sizeBytes
              ? formatFileSize(document.sizeBytes)
              : 'Click to open in Google Drive'}
          </span>
        </div>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
      </a>
    </div>
  )
}
