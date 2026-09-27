import type { ReactNode } from 'react'

import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Field, FieldGroup } from '#/components/ui/field'
import { Skeleton } from '#/components/ui/skeleton'

// Loading states for the configuration pages, shown while a page's code loads
// (route pendingComponent) and again by the settings panels while their data
// loads. Each mirrors its page's real layout so nothing shifts when the data
// replaces it: bars take the height of the real text line (text-xs 16px,
// text-sm 20px, text-base 24px, field labels 1lh of text-sm leading-snug).

// ─── Tables ─────────────────────────────────────────────────────────────────

type SkeletonColumn = { id: string; header: ReactNode; width: number }

const rightAligned = (label: string) => (
  <span className="block text-right">{label}</span>
)

/**
 * The real DataTable in its loading state, with the page's real headers and
 * column widths, so the skeleton, the data loading and the loaded table are
 * one layout.
 */
function ConfigurationTableSkeleton({
  columns,
}: {
  columns: SkeletonColumn[]
}) {
  const tableColumns: DataTableColumnDef<never>[] = columns.map((column) => ({
    ...column,
    cell: () => null,
  }))
  return (
    <DataTable columns={tableColumns} data={[]} getRowId={() => ''} isLoading />
  )
}

export function MethodListSkeleton() {
  return (
    <ConfigurationTableSkeleton
      columns={[
        { id: 'label', header: 'Method', width: 260 },
        {
          id: 'commissionRate',
          header: rightAligned('Commission'),
          width: 130,
        },
        { id: 'testing', header: rightAligned('Testing limit'), width: 220 },
        { id: 'live', header: rightAligned('Live limit'), width: 220 },
        { id: 'actions', header: rightAligned('Actions'), width: 110 },
      ]}
    />
  )
}

export function AgreementsSkeleton() {
  return (
    <ConfigurationTableSkeleton
      columns={[
        { id: 'businessType', header: 'Business Type', width: 240 },
        { id: 'currentDraft', header: 'Current Draft', width: 280 },
        { id: 'folder', header: 'Folder', width: 240 },
        { id: 'upload', header: rightAligned('Upload'), width: 280 },
      ]}
    />
  )
}

export function SubMerchantsSkeleton() {
  return (
    <ConfigurationTableSkeleton
      columns={[
        { id: 'name', header: 'Name', width: 240 },
        { id: 'sellerCode', header: 'Seller Code', width: 180 },
        { id: 'updatedAt', header: 'Updated', width: 200 },
        { id: 'actions', header: rightAligned('Actions'), width: 100 },
      ]}
    />
  )
}

export function QueuesSkeleton() {
  return (
    <ConfigurationTableSkeleton
      columns={[
        { id: 'name', header: 'Queue', width: 260 },
        { id: 'workflowType', header: 'Workflow', width: 190 },
        { id: 'prefix', header: 'Prefix', width: 100 },
        { id: 'sla', header: 'SLA', width: 140 },
        { id: 'qc', header: 'QC', width: 90 },
        { id: 'status', header: 'Lifecycle', width: 130 },
        { id: 'createdAt', header: 'Created', width: 140 },
        { id: 'actions', header: rightAligned('Actions'), width: 110 },
      ]}
    />
  )
}

// ─── Settings panels ────────────────────────────────────────────────────────

/** ConfigurationPanel: sections stacked in one bordered card. */
function PanelSkeleton({ children }: { children: ReactNode }) {
  return <div className="divide-y rounded-xl border bg-card">{children}</div>
}

/**
 * ConfigurationSection: title and description on the left (a 15rem column on
 * large screens), the controls on the right. `descriptionLines` is how many
 * lines the real description wraps to in that column.
 */
function SectionSkeleton({
  descriptionLines,
  children,
}: {
  descriptionLines: number
  children: ReactNode
}) {
  return (
    <section className="grid gap-4 p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-32" />
        <div className="flex flex-col">
          {Array.from({ length: descriptionLines }).map((_, index) => (
            <div key={index} className="flex h-5 items-center">
              <Skeleton
                className={
                  index === descriptionLines - 1 ? 'h-4 w-3/5' : 'h-4 w-full'
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

/** A labelled input: the label is one text-sm leading-snug line. */
function FieldSkeleton({
  className,
  control = 'h-9',
}: {
  className?: string
  control?: string
}) {
  return (
    <Field className={className}>
      <Skeleton className="h-lh w-28 text-sm leading-snug" />
      <Skeleton className={`w-full rounded-md ${control}`} />
    </Field>
  )
}

export function MerchantPortalSkeleton() {
  return (
    <PanelSkeleton>
      <SectionSkeleton descriptionLines={2}>
        <FieldSkeleton />
      </SectionSkeleton>
      <SectionSkeleton descriptionLines={2}>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
      </SectionSkeleton>
      <SectionSkeleton descriptionLines={2}>
        <div className="flex flex-col gap-4">
          {/* Office address textarea (min-h-16) */}
          <FieldSkeleton control="h-16" />
          <div className="grid gap-4 md:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
        </div>
      </SectionSkeleton>
    </PanelSkeleton>
  )
}

/**
 * Switch cards: an icon tile, a title over a description (text-sm
 * leading-normal, 21px a line) and the switch on the right.
 */
function SwitchCardSkeleton({
  descriptionLines,
}: {
  descriptionLines: number
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-4">
      <Skeleton className="size-8 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-lh w-28 text-sm leading-snug" />
        <div className="flex flex-col">
          {Array.from({ length: descriptionLines }).map((_, index) => (
            <div key={index} className="flex h-5.25 items-center">
              <Skeleton
                className={
                  index === descriptionLines - 1 ? 'h-4 w-3/5' : 'h-4 w-full'
                }
              />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-[1.15rem] w-8 shrink-0 rounded-full" />
    </div>
  )
}

/**
 * A section in the email sending dialog: title and description stacked above
 * the controls.
 */
function DialogSectionSkeleton({
  descriptionLines,
  children,
}: {
  descriptionLines: number
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <Skeleton className="h-5 w-32" />
        <div className="flex flex-col">
          {Array.from({ length: descriptionLines }).map((_, index) => (
            <div key={index} className="flex h-5 items-center">
              <Skeleton
                className={
                  index === descriptionLines - 1 ? 'h-4 w-3/5' : 'h-4 w-full'
                }
              />
            </div>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}

/** The email sending dialog's body while its settings load. */
export function EmailSendingSkeleton() {
  return (
    <>
      <DialogSectionSkeleton descriptionLines={1}>
        <div className="grid gap-3 md:grid-cols-2">
          <SwitchCardSkeleton descriptionLines={2} />
          <SwitchCardSkeleton descriptionLines={2} />
        </div>
      </DialogSectionSkeleton>
      <DialogSectionSkeleton descriptionLines={1}>
        <div className="flex flex-col gap-3">
          <SwitchCardSkeleton descriptionLines={1} />
          <SwitchCardSkeleton descriptionLines={1} />
        </div>
      </DialogSectionSkeleton>
      <DialogSectionSkeleton descriptionLines={2}>
        {/* CC / BCC / reply-to: label and count, the chips input (min-h-9)
            and a one-line description each. */}
        <FieldGroup>
          {Array.from({ length: 3 }).map((_, index) => (
            <Field key={index}>
              <div className="flex items-center justify-between">
                <Skeleton className="h-lh w-16 text-sm leading-snug" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-9 w-full rounded-md" />
              <div className="flex h-5.25 items-center">
                <Skeleton className="h-4 w-3/5" />
              </div>
            </Field>
          ))}
        </FieldGroup>
      </DialogSectionSkeleton>
    </>
  )
}

// ─── Limits & MDR ───────────────────────────────────────────────────────────

export function LimitsAndMdrSkeleton() {
  return (
    <Card>
      <CardContent>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <MethodPricingGroupSkeleton />
          <MethodPricingGroupSkeleton />
        </div>
      </CardContent>
    </Card>
  )
}

/** MethodGroup: an eyebrow and title, then one card per method. */
function MethodPricingGroupSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <div className="border-b pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1 h-6 w-40" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <MethodPricingCardSkeleton key={index} />
        ))}
      </div>
    </section>
  )
}

/** MethodPricingCard: name and commission box, then two limit boxes. */
function MethodPricingCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-md border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Skeleton className="h-6 w-32" />
        <div className="flex flex-col items-end rounded-md bg-background px-3 py-2 ring-1 ring-border">
          <Skeleton className="h-4 w-18" />
          <Skeleton className="h-6 w-10" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="rounded-md bg-background p-3 ring-1 ring-border"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1 h-6 w-40 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Case flow rules ────────────────────────────────────────────────────────

export function WorkflowBuilderSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="flex flex-col gap-4 xl:min-h-0 xl:flex-1 xl:flex-row">
        <div className="relative h-[60vh] min-h-105 min-w-0 overflow-hidden rounded-lg border bg-muted/20 xl:h-auto xl:min-h-0 xl:flex-1">
          <Skeleton className="absolute top-6 left-6 h-19 w-52 rounded-lg" />
          <Skeleton className="absolute top-24 left-[38%] h-19 w-59 rounded-lg" />
          <Skeleton className="absolute top-48 left-[38%] h-19 w-59 rounded-lg" />
          <Skeleton className="absolute top-36 right-[8%] h-19 w-59 rounded-lg" />
        </div>
        <Card className="shrink-0 xl:w-85">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Email templates ────────────────────────────────────────────────────────

/** The template page: preview column (toolbar, envelope, email) and rail. */
export function EmailTemplateSkeleton() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex h-6 items-center">
              <Skeleton className="h-4.5 w-44" />
            </div>
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-40 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col gap-2 border-b px-5 py-4">
          {['w-56', 'w-24', 'w-72'].map((width) => (
            <div key={width} className="flex h-5 items-center gap-4">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className={`h-3.5 ${width}`} />
            </div>
          ))}
        </div>
        <div className="bg-muted/40 px-3 py-6 sm:px-8">
          <Skeleton className="h-160 w-full rounded-md" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {[3, 5].map((lines, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-xl border bg-card p-4"
          >
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: lines }).map((_, line) => (
              <Skeleton key={line} className="h-3.5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
