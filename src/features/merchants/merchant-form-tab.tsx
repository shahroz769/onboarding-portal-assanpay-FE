import { format } from 'date-fns'
import {
  Briefcase,
  Building2,
  CreditCard,
  ExternalLink,
  FileText,
  Mail,
  User,
  Users,
} from 'lucide-react'
import type { ComponentType, ReactNode, SVGProps } from 'react'

import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'
import { cn } from '#/lib/utils'
import type {
  MerchantDetailResponse,
  MerchantDocument,
  MerchantTimelineEvent,
} from '#/schemas/merchants.schema'

import {
  documentStatusBadgeClasses,
  documentTypeLabel,
  formatCurrency,
  formatNumber,
  humanize,
  kinRelationLabel,
  merchantTypeLabel,
  websiteCmsLabel,
} from './merchant-detail-helpers'

type MerchantFormTabProps = {
  detail: MerchantDetailResponse
}

type DocumentFileView = {
  id: string
  documentType?: string
  label: string
  originalName: string
  status?: MerchantDocument['status']
  googleDriveWebViewLink: string | null
}

type DocumentSubmissionGroup = {
  id: string
  title: string
  description: string
  files: DocumentFileView[]
}

type ResubmissionFieldDetail = {
  type?: unknown
  label?: unknown
  action?: unknown
  previousFileName?: unknown
  previousFileUrl?: unknown
  nextFileName?: unknown
  nextFileUrl?: unknown
}

function SectionIcon({
  icon: Icon,
  colorClass,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
}) {
  return (
    <div
      className={cn(
        'flex size-10 items-center justify-center rounded-lg',
        colorClass,
      )}
    >
      <Icon className="size-5" />
    </div>
  )
}

function Section({
  icon,
  colorClass,
  title,
  description,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colorClass: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <SectionIcon icon={icon} colorClass={colorClass} />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {children}
      </CardContent>
    </Card>
  )
}

function ReadField({
  label,
  value,
  full,
}: {
  label: string
  value: ReactNode
  full?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', full && 'sm:col-span-2')}>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm wrap-break-word">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  )
}

export function MerchantFormTab({ detail }: MerchantFormTabProps) {
  const { merchant, documents, timeline } = detail
  const documentSubmissionGroups = getDocumentSubmissionGroups(
    documents,
    timeline,
  )

  return (
    <div className="flex flex-col gap-6">
      <Section
        icon={Mail}
        colorClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        title="Submitter"
        description="Who submitted this onboarding application."
      >
        <ReadField label="Submitter email" value={merchant.submitterEmail} />
      </Section>

      <Section
        icon={User}
        colorClass="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
        title="Owner"
        description="Primary owner of the business."
      >
        <ReadField label="Owner full name" value={merchant.ownerFullName} />
        <ReadField label="Owner phone" value={merchant.ownerPhone} />
      </Section>

      <Section
        icon={Building2}
        colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        title="Business Information"
        description="Core details about the business."
      >
        <ReadField label="Business name" value={merchant.businessName} />
        <ReadField label="Business phone" value={merchant.businessPhone} />
        <ReadField label="Business email" value={merchant.businessEmail} />
        <ReadField
          label="Website platform"
          value={websiteCmsLabel(merchant.websiteCms)}
        />
        <ReadField
          label="Business website"
          value={
            <a
              href={merchant.businessWebsite}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {merchant.businessWebsite}
              <ExternalLink className="size-3" />
            </a>
          }
        />
        <ReadField
          label="Registration date"
          value={
            merchant.businessRegistrationDate
              ? format(
                  new Date(merchant.businessRegistrationDate),
                  'dd MMM yyyy',
                )
              : '—'
          }
        />
        <ReadField label="Nature of business" value={merchant.businessNature} />
        <ReadField
          label="Business address"
          value={merchant.businessAddress}
          full
        />
        <ReadField
          label="Business description"
          value={merchant.businessDescription}
          full
        />
      </Section>

      <Section
        icon={Briefcase}
        colorClass="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        title="Business Classification"
        description="Type of entity and transaction estimates."
      >
        <ReadField
          label="Business type"
          value={merchantTypeLabel(merchant.merchantType)}
        />
        <ReadField
          label="Est. monthly transactions"
          value={formatNumber(merchant.estimatedMonthlyTransactions)}
        />
        <ReadField
          label="Est. monthly volume"
          value={formatCurrency(
            merchant.estimatedMonthlyVolume,
            merchant.currency,
          )}
        />
      </Section>

      <Section
        icon={CreditCard}
        colorClass="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
        title="Financial Information"
        description="Settlement bank account details."
      >
        <ReadField label="Account title" value={merchant.accountTitle} />
        <ReadField label="Bank name" value={merchant.bankName} />
        <ReadField label="Branch name" value={merchant.branchName} />
        <ReadField
          label="Account number / IBAN"
          value={merchant.accountNumberIban}
        />
        <ReadField label="SWIFT code" value={merchant.swiftCode ?? '—'} />
      </Section>

      <Section
        icon={Users}
        colorClass="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
        title="Next of Kin"
        description="Declared next of kin relationship."
      >
        <ReadField
          label="Relation"
          value={kinRelationLabel(merchant.nextOfKinRelation)}
        />
      </Section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon
              icon={FileText}
              colorClass="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            />
            <div>
              <CardTitle>Uploaded Documents</CardTitle>
              <CardDescription>
                {documents.length} document
                {documents.length === 1 ? '' : 's'} submitted with this
                application.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {documentSubmissionGroups.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No documents uploaded.
            </p>
          ) : (
            documentSubmissionGroups.map((group, groupIndex) => (
              <DocumentSubmissionSection
                key={group.id}
                group={group}
                showSeparator={groupIndex > 0}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentSubmissionSection({
  group,
  showSeparator,
}: {
  group: DocumentSubmissionGroup
  showSeparator: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      {showSeparator ? <Separator /> : null}
      <div className="flex flex-col gap-0.5 py-2">
        <h3 className="text-sm font-semibold">{group.title}</h3>
        <p className="text-xs text-muted-foreground">{group.description}</p>
      </div>
      {group.files.map((file, index) => (
        <DocumentRow key={file.id} file={file} showSeparator={index > 0} />
      ))}
    </div>
  )
}

function DocumentRow({
  file,
  showSeparator,
}: {
  file: DocumentFileView
  showSeparator: boolean
}) {
  return (
    <>
      {showSeparator ? <Separator /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {file.documentType ? documentTypeLabel(file.documentType) : file.label}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {file.originalName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {file.status ? (
            <Badge
              variant="secondary"
              className={documentStatusBadgeClasses(file.status)}
            >
              {humanize(file.status)}
            </Badge>
          ) : null}
          {file.googleDriveWebViewLink ? (
            <a
              href={file.googleDriveWebViewLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </div>
    </>
  )
}

function getDocumentSubmissionGroups(
  documents: MerchantDocument[],
  timeline: MerchantTimelineEvent[],
): DocumentSubmissionGroup[] {
  const resubmissionGroups = timeline
    .filter((event) => event.action === 'client_resubmitted')
    .map((event, index) => {
      const files = getResubmittedFiles(event, index)

      return {
        id: `resubmission-${event.id}`,
        title: `Merchant update ${index + 1}`,
        description: `Submitted after document review on ${format(
          new Date(event.createdAt),
          'dd MMM yyyy, hh:mm a',
        )}`,
        files,
      }
    })
    .filter((group) => group.files.length > 0)

  const originalFiles = getOriginalSubmittedFiles(documents, timeline)

  return [
    {
      id: 'merchant-submitted',
      title: 'Merchant submitted',
      description: 'Initial onboarding submission.',
      files: originalFiles,
    },
    ...resubmissionGroups,
  ].filter((group) => group.files.length > 0)
}

function getOriginalSubmittedFiles(
  documents: MerchantDocument[],
  timeline: MerchantTimelineEvent[],
): DocumentFileView[] {
  const earliestPreviousByLabel = new Map<string, DocumentFileView>()

  for (const event of timeline.filter(
    (entry) => entry.action === 'client_resubmitted',
  )) {
    getPreviousResubmittedFiles(event).forEach((file) => {
      if (!earliestPreviousByLabel.has(file.label)) {
        earliestPreviousByLabel.set(file.label, file)
      }
    })
  }

  const currentFiles = documents.map((doc) => ({
    id: doc.id,
    documentType: doc.documentType,
    label: documentTypeLabel(doc.documentType),
    originalName: doc.originalName,
    status: doc.status,
    googleDriveWebViewLink: doc.googleDriveWebViewLink,
  }))

  if (earliestPreviousByLabel.size === 0) return currentFiles

  const originals = currentFiles.map(
    (file) => earliestPreviousByLabel.get(file.label) ?? file,
  )

  for (const previousFile of earliestPreviousByLabel.values()) {
    if (!originals.some((file) => file.label === previousFile.label)) {
      originals.push(previousFile)
    }
  }

  return originals
}

function getPreviousResubmittedFiles(
  event: MerchantTimelineEvent,
): DocumentFileView[] {
  return getResubmissionFieldDetails(event.details).flatMap(
    (detail, detailIndex) => {
      const label = getString(detail.label) ?? 'Document'
      const previousFileName = getString(detail.previousFileName)
      const previousFileUrl = getString(detail.previousFileUrl)

      if (!previousFileName && !previousFileUrl) return []

      return [
        {
          id: `${event.id}-previous-${detailIndex}`,
          label,
          originalName: previousFileName ?? 'Previous file',
          googleDriveWebViewLink: previousFileUrl,
        },
      ]
    },
  )
}

function getResubmittedFiles(
  event: MerchantTimelineEvent,
  eventIndex: number,
): DocumentFileView[] {
  const details = getResubmissionFieldDetails(event.details)
  const files: DocumentFileView[] = []

  details.forEach((detail, detailIndex) => {
    const label = getString(detail.label) ?? 'Document'
    const previousFileName = getString(detail.previousFileName)
    const previousFileUrl = getString(detail.previousFileUrl)
    const nextFileName = getString(detail.nextFileName)
    const nextFileUrl = getString(detail.nextFileUrl)

    if (previousFileName || previousFileUrl) {
      files.push({
        id: `${event.id}-previous-${detailIndex}`,
        label,
        originalName: previousFileName ?? 'Previous file',
        googleDriveWebViewLink: previousFileUrl,
      })
    }

    if (nextFileName || nextFileUrl) {
      files.push({
        id: `${event.id}-next-${detailIndex}`,
        label,
        originalName: nextFileName ?? `Merchant update ${eventIndex + 1}`,
        googleDriveWebViewLink: nextFileUrl,
      })
    }
  })

  return files.filter((file) => !file.id.includes('-previous-'))
}

function getResubmissionFieldDetails(
  details: unknown,
): ResubmissionFieldDetail[] {
  if (!details || typeof details !== 'object') return []

  const fieldDetails = (details as { fieldsUpdatedDetails?: unknown })
    .fieldsUpdatedDetails
  if (!Array.isArray(fieldDetails)) return []

  return fieldDetails.filter(
    (detail): detail is ResubmissionFieldDetail =>
      Boolean(detail) &&
      typeof detail === 'object' &&
      (detail as ResubmissionFieldDetail).type === 'document',
  )
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}
