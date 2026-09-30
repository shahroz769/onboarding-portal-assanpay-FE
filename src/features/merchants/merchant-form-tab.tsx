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

import { TruncatedTooltip } from '#/components/truncated-tooltip'
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
  MerchantDocument,
  MerchantFormResponse,
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
  detail: MerchantFormResponse
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
            <CardTitle render={<h2 />}>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{children}</dl>
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
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      {/* Boxed like the onboarding form fields, so reviewers read the
          application as the merchant filled it in. */}
      <dd className="rounded-md border bg-muted/40 px-3 py-2 text-sm wrap-break-word">
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  )
}

export function MerchantFormTab({ detail }: MerchantFormTabProps) {
  const { agreements, documentReviewApproved, documents, merchant } = detail
  const documentSubmissionGroup = getCurrentDocumentSubmissionGroup(
    documents,
    documentReviewApproved,
  )

  // Wide screens: application fields on the left, documents and agreements
  // in a sticky column on the right so they stay in view while reviewing.
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_32rem]">
      <div className="flex min-w-0 flex-col gap-6">
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
          title="Business information"
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
                className="text-primary underline underline-offset-4 wrap-anywhere"
              >
                {merchant.businessWebsite}
                <span className="sr-only"> (opens in new tab)</span>
                <ExternalLink className="ms-1 inline size-3 align-baseline" />
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
          <ReadField
            label="Nature of business"
            value={merchant.businessNature}
          />
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
          title="Business classification"
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
          title="Financial information"
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
          title="Next of kin"
          description="Declared next of kin relationship."
        >
          <ReadField
            label="Relation"
            value={kinRelationLabel(merchant.nextOfKinRelation)}
          />
        </Section>
      </div>

      {/* Capped to the scroll area (6.5rem = 3.5rem app header + 1.5rem
          padding above and below) so a long document list scrolls inside the
          column instead of running past the bottom of the screen. */}
      <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6 xl:max-h-[calc(100svh-6.5rem)] xl:overflow-y-auto xl:overscroll-contain">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <SectionIcon icon={FileText} tone="indigo" />
              <div>
                <CardTitle render={<h2 />}>Uploaded documents</CardTitle>
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
                <CardTitle render={<h2 />}>Agreements</CardTitle>
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
          <TruncatedTooltip
            render={<div className="min-w-0" />}
            content={file.originalName}
          >
            <p className="truncate text-sm font-medium">
              {file.documentType
                ? documentTypeLabel(file.documentType)
                : file.label}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {file.originalName}
            </p>
          </TruncatedTooltip>
        </div>
        <div className="flex items-center gap-2">
          {file.statusLabel ? (
            <Badge variant="secondary">{file.statusLabel}</Badge>
          ) : null}
          {file.googleDriveWebViewLink ? (
            <ViewFileLink
              href={file.googleDriveWebViewLink}
              name={
                file.documentType
                  ? documentTypeLabel(file.documentType)
                  : file.label
              }
            />
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
        <TruncatedTooltip
          render={<div className="min-w-0" />}
          content={file ? file.originalName : title}
        >
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {file
              ? `${file.originalName} · ${formatFileSize(file.sizeBytes)} · ${format(
                  new Date(file.createdAt),
                  'dd MMM yyyy',
                )}`
              : emptyText}
          </p>
        </TruncatedTooltip>
      </div>
      <div className="flex items-center gap-2">
        {file ? (
          <Badge variant="outline">Uploaded</Badge>
        ) : (
          <Badge variant="secondary">Not uploaded</Badge>
        )}
        {file?.googleDriveWebViewLink ? (
          <ViewFileLink href={file.googleDriveWebViewLink} name={title} />
        ) : null}
      </div>
    </div>
  )
}

// Every file row has a "View" link, so the file name is added for screen
// reader link lists.
function ViewFileLink({ href, name }: { href: string; name: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-4"
    >
      View<span className="sr-only"> {name} (opens in new tab)</span>
      <ExternalLink className="size-3" />
    </a>
  )
}

function getCurrentDocumentSubmissionGroup(
  documents: MerchantDocument[],
  documentReviewApproved: boolean,
): DocumentSubmissionGroup {
  return {
    id: 'current-documents',
    title: documentReviewApproved
      ? 'Approved documents'
      : 'Latest submitted documents',
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
