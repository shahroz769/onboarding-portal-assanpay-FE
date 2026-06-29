import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { FileText, History, LayoutGrid, Wallet } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAuth } from '#/features/auth/auth-client'
import { merchantDetailQueryOptions } from '#/hooks/use-merchants-query'

import { MerchantFormTab } from './merchant-form-tab'
import { MerchantHistoryTab } from './merchant-history-tab'
import { MerchantLimitsMdrTab } from './merchant-limits-mdr-tab'
import { MerchantOverviewTab } from './merchant-overview-tab'

type MerchantDetailsProps = {
  merchantId: string
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
    case 'testing':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300'
    case 'live':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
    case 'terminated':
      return 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300'
    default:
      return ''
  }
}

export function MerchantDetails({ merchantId }: MerchantDetailsProps) {
  const { data: detail, isPending } = useQuery(
    merchantDetailQueryOptions(merchantId),
  )
  const { user } = useAuth()
  const canEdit = user?.roleType === 'admin' || user?.roleType === 'supervisor'

  if (isPending || !detail) {
    return <MerchantDetailsSkeleton />
  }

  const { merchant } = detail

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
              {merchant.businessName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {merchant.businessName}
                </h2>
                <Badge
                  variant="secondary"
                  className={statusBadgeClasses(merchant.status)}
                >
                  {merchant.status.charAt(0).toUpperCase() +
                    merchant.status.slice(1)}
                </Badge>
                {merchant.priority === 'high' ? (
                  <Badge variant="default">High priority</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-mono">#{merchant.merchantNumber}</span> ·{' '}
                {merchant.ownerFullName} · Joined{' '}
                {format(new Date(merchant.submittedAt), 'dd MMM yyyy')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="gap-6">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-fit">
          <TabsTrigger value="overview">
            <LayoutGrid />
            Overview
          </TabsTrigger>
          <TabsTrigger value="form">
            <FileText />
            Form and Agreement
          </TabsTrigger>
          <TabsTrigger value="limits">
            <Wallet />
            MDR &amp; Limits
          </TabsTrigger>
          <TabsTrigger value="history">
            <History />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <MerchantOverviewTab detail={detail} />
        </TabsContent>
        <TabsContent value="form">
          <MerchantFormTab detail={detail} />
        </TabsContent>
        <TabsContent value="limits">
          <MerchantLimitsMdrTab detail={detail} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="history">
          <MerchantHistoryTab detail={detail} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function MerchantDetailsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
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

      <Tabs defaultValue="overview" className="gap-6">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-fit">
          <TabsTrigger value="overview">
            <LayoutGrid />
            Overview
          </TabsTrigger>
          <TabsTrigger value="form">
            <FileText />
            Form and Agreement
          </TabsTrigger>
          <TabsTrigger value="limits">
            <Wallet />
            MDR &amp; Limits
          </TabsTrigger>
          <TabsTrigger value="history">
            <History />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <MerchantOverviewSkeleton />
        </TabsContent>
        <TabsContent value="form">
          <MerchantFormSkeleton />
        </TabsContent>
        <TabsContent value="limits">
          <MerchantLimitsSkeleton />
        </TabsContent>
        <TabsContent value="history">
          <MerchantHistorySkeleton />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MerchantOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <MerchantSectionSkeleton
          key={index}
          fieldCount={index === 3 ? 6 : index > 3 ? 3 : 4}
          columns={index === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-3'}
        />
      ))}
    </div>
  )
}

function MerchantFormSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <MerchantSectionSkeleton
          key={index}
          fieldCount={index === 2 ? 8 : 2}
          columns="sm:grid-cols-2"
        />
      ))}
      <Card>
        <CardHeader>
          <MerchantSectionHeaderSkeleton />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center justify-between gap-3 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-9 rounded-md" />
                <div className="flex min-w-0 flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function MerchantLimitsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <MerchantSectionSkeleton key={index} fieldCount={4} columns="" />
        ))}
      </div>
      <div className="flex justify-end gap-3">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  )
}

function MerchantHistorySkeleton() {
  return (
    <div className="flex flex-col gap-6">
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
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, rowIndex) => (
                  <div key={rowIndex} className="flex gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-52 max-w-full" />
                      <Skeleton className="h-3 w-72 max-w-full" />
                    </div>
                  </div>
                ))}
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
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-40 max-w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
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
