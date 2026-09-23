import type { ComponentType, SVGProps } from 'react'
import {
  Building2,
  Briefcase,
  CalendarIcon,
  CheckCircle2,
  Clipboard,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Info,
  Mail,
  User,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button, ButtonLink } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '#/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
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

import type { QueueRendererProps } from '../queue-registry'

const DIALOGPAY_PORTAL_URL = 'https://www.dialogpay.net/login'

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

type DialogPayDocument = {
  key: string
  label: string
  url: string
  downloadUrl: string
  name: string
  sizeBytes: number | null
  isRequired: boolean
}

type MerchantDocument = {
  id: string
  originalName?: string | null
  googleDriveWebViewLink?: string | null
  googleDriveDownloadLink?: string | null
  documentType?: string | null
  sizeBytes?: number | null
}

const CMS_LABELS = new Map<string, string>(
  WEBSITE_CMS_OPTIONS.map((option) => [option.value, option.label]),
)
const MERCHANT_TYPE_LABELS = new Map<string, string>(
  MERCHANT_TYPES.map((option) => [option.value, option.label]),
)
const RELATION_LABELS = new Map<string, string>(
  KIN_RELATIONS.map((option) => [option.value, option.label]),
)

const REVIEW_SECTIONS: ReviewSection[] = [
  {
    title: 'Submitter Information',
    description: 'Email address of the person submitting this form',
    icon: Mail,
    toneClass: 'bg-blue-500/10 text-blue-500',
    layout: 'two-column',
    fields: [
      { key: 'submitterEmail', label: 'Submitter Email' },
      { key: 'activeWhatsappNumber', label: 'Active WhatsApp Number' },
    ],
  },
  {
    title: 'Director/CEO/Owner Information',
    description: 'Details of the Director, CEO, or owner',
    icon: User,
    toneClass: 'bg-amber-500/10 text-amber-500',
    layout: 'two-column',
    fields: [
      { key: 'ownerFullName', label: 'Full Name' },
      { key: 'ownerPhone', label: 'Phone Number' },
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
      { key: 'businessNature', label: 'Nature of Business' },
    ],
  },
  {
    title: 'Business Classification',
    description: 'Business type and transaction estimates',
    icon: Briefcase,
    toneClass: 'bg-teal-500/10 text-teal-500',
    layout: 'two-column',
    fields: [
      {
        key: 'merchantType',
        label: 'Business Type',
        className: 'sm:col-span-2',
        resolveValue: (value) =>
          MERCHANT_TYPE_LABELS.get(String(value)) ?? String(value),
      },
      {
        key: 'estimatedMonthlyTransactions',
        label: 'Estimated Monthly Transactions',
      },
      {
        key: 'estimatedMonthlyVolume',
        label: 'Estimated Monthly Volume (PKR)',
      },
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

  return CARD_DATE_FORMATTER.format(date)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getStepCopy(stageSlug: string | undefined) {
  switch (stageSlug) {
    case 'working':
      return {
        title: 'Create merchant on DialogPay',
        description:
          'Copy the merchant details below into the DialogPay portal. After submitting the merchant, use Workflow actions to mark it created.',
        badge: 'Portal creation',
      }
    case 'merchant_pending':
      return {
        title: 'Merchant pending DialogPay approval',
        description:
          'The merchant has been submitted on DialogPay. Once DialogPay approves it, mark the merchant as approved.',
        badge: 'Pending approval',
      }
    case 'docs_upload':
      return {
        title: 'Upload merchant documents',
        description:
          'Download or open the files below and upload them on the DialogPay portal. Then mark documents uploaded.',
        badge: 'Document upload',
      }
    case 'docs_pending':
      return {
        title: 'Documents pending DialogPay approval',
        description:
          'Documents have been uploaded on DialogPay. Once DialogPay approves them, mark documents approved to close the case.',
        badge: 'Pending approval',
      }
    case 'closed':
      return {
        title: 'DialogPay Card case complete',
        description: 'Merchant creation and document upload are approved.',
        badge: 'Complete',
      }
    default:
      return {
        title: 'DialogPay Card workflow',
        description:
          'Take ownership to begin merchant creation on the DialogPay portal.',
        badge: 'New',
      }
  }
}

async function copyValue(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Copy failed')
  }
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

export default function DialogPayCardRenderer({
  caseDetail,
}: QueueRendererProps) {
  const merchantData = caseDetail.merchant
  const stepCopy = getStepCopy(caseDetail.currentStage?.slug)

  const sections = (() => {
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

      return { ...section, items }
    }).filter((section) => section.items.length > 0)
  })()

  const documents = (() => {
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
        const document = rawDocument as MerchantDocument
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
            : (document.documentType ??
              document.originalName ??
              'Uploaded Document'),
          url,
          downloadUrl: document.googleDriveDownloadLink?.trim() || url,
          name: document.originalName ?? 'Uploaded document',
          sizeBytes: document.sizeBytes ?? null,
          isRequired: documentKey ? requiredDocs.has(documentKey) : false,
        }
      })
      .filter((item): item is DialogPayDocument => item !== null)
  })()

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info />
        <AlertTitle>{stepCopy.title}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>{stepCopy.description}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{stepCopy.badge}</Badge>
            <ButtonLink
              variant="outline"
              size="sm"
              render={
                <a
                  href={DIALOGPAY_PORTAL_URL}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <ExternalLink data-icon="inline-start" />
              Open DialogPay
            </ButtonLink>
          </div>
        </AlertDescription>
      </Alert>

      <Card className="py-4">
        <CardContent className="px-4 py-0">
          <div className="flex flex-col gap-5">
            {sections.map((section, index) => (
              <div key={section.title} className="flex flex-col gap-4">
                {index > 0 ? <Separator /> : null}
                <div className="flex items-center gap-3">
                  <SectionIcon
                    icon={section.icon}
                    toneClass={section.toneClass}
                  />

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
                    <ReadOnlyCopyField key={item.key} item={item} />
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
                    Uploaded merchant files for DialogPay document upload.
                  </CardDescription>
                </div>
              </div>

              {documents.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {documents.map((document) => (
                    <DialogPayDocumentField
                      key={document.key}
                      document={document}
                    />
                  ))}
                </div>
              ) : (
                <Alert>
                  <Info />
                  <AlertTitle>No uploaded documents</AlertTitle>
                  <AlertDescription>
                    This case currently has no document links available.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReadOnlyCopyField({ item }: { item: ReviewItem }) {
  return (
    <Field className={item.className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FieldLabel className="min-w-0">{item.label}</FieldLabel>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => copyValue(item.label, item.displayValue)}
        >
          <Clipboard />
          <span className="sr-only">Copy {item.label}</span>
        </Button>
      </div>

      {item.kind === 'textarea' ? (
        <Textarea
          value={item.displayValue}
          readOnly
          className="min-h-20 resize-none"
        />
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

function DialogPayDocumentField({ document }: { document: DialogPayDocument }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium">{document.label}</span>
          {document.isRequired ? (
            <Badge variant="secondary">Required</Badge>
          ) : null}
        </div>
        <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-3">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm">{document.name}</span>
          <span className="text-xs text-muted-foreground">
            {document.sizeBytes
              ? formatFileSize(document.sizeBytes)
              : 'Google Drive file'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ButtonLink
          variant="outline"
          size="sm"
          render={<a href={document.url} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink data-icon="inline-start" />
          Open
        </ButtonLink>
        <ButtonLink
          variant="outline"
          size="sm"
          render={
            <a href={document.downloadUrl} target="_blank" rel="noreferrer" />
          }
        >
          <Download data-icon="inline-start" />
          Download
        </ButtonLink>
      </div>
    </div>
  )
}
const CARD_DATE_FORMATTER = new Intl.DateTimeFormat('en-PK', {
  dateStyle: 'medium',
  timeZone: 'Asia/Karachi',
})
