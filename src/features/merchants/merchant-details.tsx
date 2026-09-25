import { useQuery } from '@tanstack/react-query'
import { Link, Outlet } from '@tanstack/react-router'
import { format } from 'date-fns'

import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { merchantHeaderQueryOptions } from '#/hooks/use-merchants-query'
import { cn } from '#/lib/utils'
import { merchantStatusBadgeClasses } from '#/lib/status-styles'
import type { MerchantHeader } from '#/schemas/merchants.schema'
import { MERCHANT_DETAIL_TABS } from './merchant-detail-tabs'

const merchantDetailTabClassName =
  'relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors hover:text-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'

type MerchantDetailsLayoutProps = {
  merchantId: string
}

export function MerchantDetailsLayout({
  merchantId,
}: MerchantDetailsLayoutProps) {
  const {
    data: header,
    error,
    isError,
  } = useQuery(merchantHeaderQueryOptions(merchantId))

  if (isError && !header) {
    throw error
  }

  return (
    <div className="flex flex-col gap-6">
      {header ? (
        <MerchantDetailsHeader header={header} />
      ) : (
        <MerchantDetailsHeaderSkeleton />
      )}
      <div className="flex flex-col gap-6">
        <nav
          aria-label="Merchant sections"
          className="grid h-auto w-full grid-cols-2 rounded-lg bg-muted p-0.75 text-muted-foreground sm:inline-flex sm:w-fit"
        >
          {MERCHANT_DETAIL_TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ merchantId }}
              activeOptions={{ exact: true }}
              className={merchantDetailTabClassName}
              activeProps={{
                className:
                  'bg-background font-medium text-foreground shadow-sm',
              }}
            >
              <tab.icon />
              {tab.label}
            </Link>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  )
}

function MerchantDetailsHeader({ header }: { header: MerchantHeader }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
            {header.businessName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                {header.businessName}
              </h2>
              <Badge
                variant="secondary"
                className={merchantStatusBadgeClasses(header.status)}
              >
                {header.status.charAt(0).toUpperCase() + header.status.slice(1)}
              </Badge>
              {header.priority === 'high' ? (
                <Badge variant="default">High priority</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">#{header.merchantNumber}</span> ·{' '}
              {header.ownerFullName} · Joined{' '}
              {format(new Date(header.submittedAt), 'dd MMM yyyy')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MerchantDetailsHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-xl" />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function MerchantOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <MerchantSectionSkeleton
        fieldCount={6}
        columns="sm:grid-cols-2 lg:grid-cols-3"
      />
      <MerchantSectionSkeleton
        fieldCount={4}
        columns="sm:grid-cols-2 lg:grid-cols-3"
      />
      <MerchantSectionSkeleton
        fieldCount={5}
        columns="sm:grid-cols-2 lg:grid-cols-3"
      />
      <Card>
        <CardHeader>
          <MerchantSectionHeaderSkeleton />
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <MerchantRateRowSkeleton />
          <MerchantRateRowSkeleton />
          <MerchantPaymentMethodsSkeleton className="sm:col-span-2 lg:col-span-3" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <MerchantSectionHeaderSkeleton />
        </CardHeader>
        <CardContent>
          <MerchantPaymentMethodsSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}

export function MerchantFormSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <MerchantReadFieldsSkeleton fieldCount={1} />
      <MerchantReadFieldsSkeleton fieldCount={3} />
      <MerchantReadFieldsSkeleton fieldCount={9} />
      <MerchantReadFieldsSkeleton fieldCount={3} />
      <MerchantReadFieldsSkeleton fieldCount={5} />
      <MerchantReadFieldsSkeleton fieldCount={1} />
      <Card>
        <CardHeader>
          <MerchantSectionHeaderSkeleton />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 py-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <MerchantFileRowSkeleton key={index} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <MerchantSectionHeaderSkeleton />
        </CardHeader>
        <CardContent>
          <MerchantFileRowSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}

export function MerchantLimitsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent>
          <MerchantPaymentMethodsSkeleton />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent>
          <MerchantPaymentMethodsSkeleton />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <MerchantLimitFieldsSkeleton />
        <MerchantLimitFieldsSkeleton />
        <MerchantLimitFieldsSkeleton fieldCount={1} />
      </div>
      <div className="flex justify-end gap-3">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
    </div>
  )
}

export function MerchantHistorySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <MerchantSectionHeaderSkeleton />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <MerchantTimelineRowSkeleton />
          <MerchantTimelineRowSkeleton />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <MerchantSectionHeaderSkeleton />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border bg-muted/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="size-2 rounded-full" />
                </div>
                <Skeleton className="mt-2 h-8 w-10" />
              </div>
            ))}
          </div>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <MerchantTimelineRowSkeleton />
                <MerchantTimelineRowSkeleton />
                <MerchantTimelineRowSkeleton />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function MerchantSectionSkeleton({
  fieldCount,
  columns,
}: {
  fieldCount: number
  columns: string
}) {
  return (
    <Card>
      <CardHeader>
        <MerchantSectionHeaderSkeleton />
      </CardHeader>
      <CardContent className={`grid gap-x-8 gap-y-5 ${columns}`}>
        {Array.from({ length: fieldCount }).map((_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-40 max-w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function MerchantReadFieldsSkeleton({ fieldCount }: { fieldCount: number }) {
  return (
    <Card>
      <CardHeader>
        <MerchantSectionHeaderSkeleton />
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {Array.from({ length: fieldCount }).map((_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function MerchantPaymentMethodsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2', className)}>
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-4 rounded-md border bg-muted/20 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-12 w-24 rounded-md" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

function MerchantRateRowSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-4 w-28" />
    </div>
  )
}

function MerchantLimitFieldsSkeleton({
  fieldCount = 2,
}: {
  fieldCount?: number
}) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-48 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: fieldCount }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function MerchantFileRowSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="size-9 rounded-md" />
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  )
}

function MerchantTimelineRowSkeleton() {
  return (
    <div className="flex gap-3">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-52 max-w-full" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
    </div>
  )
}

function MerchantSectionHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-10 rounded-lg" />
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
    </div>
  )
}
