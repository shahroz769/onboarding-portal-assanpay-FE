import { useSuspenseQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { FileText, History, LayoutGrid, Wallet } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
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
  const { data: detail } = useSuspenseQuery(
    merchantDetailQueryOptions(merchantId),
  )
  const { user } = useAuth()
  const canEdit = user?.roleType === 'admin' || user?.roleType === 'supervisor'

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
                <span className="font-mono">
                  #{merchant.merchantNumber}
                </span>{' '}
                · {merchant.ownerFullName} · Joined{' '}
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
            Form
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
