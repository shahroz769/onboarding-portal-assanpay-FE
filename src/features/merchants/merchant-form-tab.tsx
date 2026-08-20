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
import { SectionIcon } from '#/components/section-icon'
import { Separator } from '#/components/ui/separator'
import { cn } from '#/lib/utils'
import type { StatusTint } from '#/lib/status-styles'
import type {
  MerchantAgreementFile,
  MerchantDetailResponse,
  MerchantDocument,
} from '#/schemas/merchants.schema'

import {
  documentTypeLabel,
  formatCurrency,
  formatNumber,
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
  statusLabel?: string
  googleDriveWebViewLink: string | null
}

type DocumentSubmissionGroup = {
  id: string
  title: string
  description: string
  files: DocumentFileView[]
}

function Section({
  icon,
  tone,
  title,
  description,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <SectionIcon icon={icon} tone={tone} />
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
  const { agreements, documents, merchant } = detail
  const documentReviewApproved = isDocumentReviewApproved(detail)
  const documentSubmissionGroup = getCurrentDocumentSubmissionGroup(
    documents,
    documentReviewApproved,
  )

  return (
    <div className="flex flex-col gap-6">
      <Section
        icon={Mail}
        tone="blue"
        title="Submitter"
        description="Who submitted this onboarding application."
      >
        <ReadField label="Submitter email" value={merchant.submitterEmail} />
      </Section>

      <Section
        icon={User}
        tone="violet"
        title="Owner"
        description="Primary owner of the business."
      >
        <ReadField label="Owner full name" value={merchant.ownerFullName} />
        <ReadField label="Owner phone" value={merchant.ownerPhone} />
        <ReadField
          label="Active WhatsApp number"
          value={merchant.activeWhatsappNumber}
        />
      </Section>

      <Section
        icon={Building2}
        tone="emerald"
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
        tone="amber"
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
        tone="sky"
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
        tone="rose"
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
            <SectionIcon icon={FileText} tone="indigo" />
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
          {documentSubmissionGroup.files.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No documents uploaded.
            </p>
          ) : (
            <DocumentSubmissionSection group={documentSubmissionGroup} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon icon={FileText} tone="teal" />
            <div>
              <CardTitle>Agreements</CardTitle>
              <CardDescription>
                Signed physical agreement received by the office.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <AgreementRow
            title="Received signed agreement"
            emptyText="The signed physical agreement has not been received yet."
            file={agreements.receivedSignedAgreement}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentSubmissionSection({
  group,
}: {
  group: DocumentSubmissionGroup
}) {
  return (
    <div className="flex flex-col gap-2">
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
              {file.documentType
                ? documentTypeLabel(file.documentType)
                : file.label}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {file.originalName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {file.statusLabel ? (
            <Badge variant="secondary">{file.statusLabel}</Badge>
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

function AgreementRow({
  title,
  emptyText,
  file,
}: {
  title: string
  emptyText: string
  file: MerchantAgreementFile | null
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <FileText className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {file
              ? `${file.originalName} - ${formatFileSize(file.sizeBytes)} - ${format(
                  new Date(file.createdAt),
                  'dd MMM yyyy',
                )}`
              : emptyText}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {file ? (
          <Badge variant="outline">Uploaded</Badge>
        ) : (
          <Badge variant="secondary">Not uploaded</Badge>
        )}
        {file?.googleDriveWebViewLink ? (
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
  )
}

function getCurrentDocumentSubmissionGroup(
  documents: MerchantDocument[],
  documentReviewApproved: boolean,
): DocumentSubmissionGroup {
  return {
    id: 'current-documents',
    title: documentReviewApproved
      ? 'Approved Documents'
      : 'Latest Submitted Documents',
    description: documentReviewApproved
      ? 'Documents approved through Document Review.'
      : 'Current submitted documents awaiting Document Review closure.',
    files: documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      label: documentTypeLabel(doc.documentType),
      originalName: doc.originalName,
      statusLabel: documentReviewApproved ? undefined : 'Unapproved',
      googleDriveWebViewLink: doc.googleDriveWebViewLink,
    })),
  }
}

function isDocumentReviewApproved(detail: MerchantDetailResponse) {
  return detail.cases.some(
    (caseItem) =>
      normalizeCaseName(caseItem.queueName) === 'documents review' &&
      normalizeCaseName(caseItem.status) === 'closed' &&
      normalizeCaseName(caseItem.closeOutcome) === 'successful',
  )
}

function normalizeCaseName(value: string | null) {
  return (value ?? '').trim().toLowerCase().replace(/[-_]+/g, ' ')
}

function formatFileSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB'] as const
  const unitIndex = Math.min(
    Math.floor(Math.log(sizeBytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = sizeBytes / 1024 ** unitIndex

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
