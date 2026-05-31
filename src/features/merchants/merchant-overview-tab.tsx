import { format } from 'date-fns'
import { Activity, Building2, CalendarClock, Wallet } from 'lucide-react'
import type { ComponentType, ReactNode, SVGProps } from 'react'

import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { cn } from '#/lib/utils'
import type { MerchantDetailResponse } from '#/schemas/merchants.schema'

import {
  formatNumber,
  isCaseOpen,
} from './merchant-detail-helpers'

type MerchantOverviewTabProps = {
  detail: MerchantDetailResponse
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return '—'
  return format(new Date(value), withTime ? 'dd MMM yyyy, hh:mm a' : 'dd MMM yyyy')
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

export function MerchantOverviewTab({ detail }: MerchantOverviewTabProps) {
  const { merchant, cases, milestones, limitsAndMdr } = detail

  const openCases = cases.filter((c) => isCaseOpen(c.status, c.stageCategory))
  const workingCases = cases.filter((c) => c.status === 'working')
  const closedCases = cases.filter(
    (c) => !isCaseOpen(c.status, c.stageCategory),
  )
  const breachedCases = openCases.filter((c) => c.slaBreached)

  const activeRates =
    merchant.status === 'live'
      ? limitsAndMdr.effective.live
      : limitsAndMdr.effective.testing
  const activeRatesLabel =
    merchant.status === 'live' ? 'Live Limits' : 'Testing Limits'

  return (
    <div className="flex flex-col gap-6">
      <ProfileSection
        icon={Building2}
        colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        title="Profile"
        description="Business identity and onboarding status."
      >
        <Detail label="Business name" value={merchant.businessName} />
        <Detail label="Owner" value={merchant.ownerFullName} />
        <Detail
          label="Status"
          value={
            <Badge
              variant="secondary"
              className={merchantStatusBadge(merchant.status)}
            >
              {merchant.status.charAt(0).toUpperCase() +
                merchant.status.slice(1)}
            </Badge>
          }
        />
        <Detail
          label="Priority"
          value={
            <Badge
              variant={merchant.priority === 'high' ? 'default' : 'outline'}
            >
              {merchant.priority === 'high' ? 'High' : 'Normal'}
            </Badge>
          }
        />
        <Detail
          label="Business scope"
          value={
            merchant.businessScope === 'international'
              ? 'International'
              : 'Local'
          }
        />
        <Detail label="Currency" value={merchant.currency} />
      </ProfileSection>

      <ProfileSection
        icon={CalendarClock}
        colorClass="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        title="Journey"
        description="Key timestamps across the merchant lifecycle."
      >
        <Detail
          label="Form Filled"
          value={formatDate(milestones.formFilledAt, true)}
        />
        <Detail
          label="Testing Started"
          value={formatDate(milestones.testStartedAt, true)}
        />
        <Detail label="Went Live" value={formatDate(milestones.liveAt, true)} />
        <Detail
          label="Last Updated"
          value={formatDate(merchant.updatedAt, true)}
        />
      </ProfileSection>

      <ProfileSection
        icon={Activity}
        colorClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        title="Cases"
        description="Workflow case counts and current SLA signal."
      >
        <Detail label="Total cases" value={cases.length} />
        <Detail label="Open" value={openCases.length} />
        <Detail label="Working" value={workingCases.length} />
        <Detail label="Closed" value={closedCases.length} />
        <Detail label="SLA breached" value={breachedCases.length} />
      </ProfileSection>

      <ProfileSection
        icon={Wallet}
        colorClass="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
        title="MDR &amp; Limits"
        description={`${activeRatesLabel} · ${
          limitsAndMdr.isOverridden
            ? 'Custom for merchant'
            : 'Global configuration'
        }`}
      >
        <RateRow
          label="Collection range"
          value={`${formatNumber(activeRates.collectionMin)} – ${formatNumber(activeRates.collectionMax)}`}
        />
        <RateRow
          label="Disbursement range"
          value={`${formatNumber(activeRates.disbursementMin)} – ${formatNumber(activeRates.disbursementMax)}`}
        />
        <RateRow
          label="E-wallets MDR"
          value={`${limitsAndMdr.effective.rates.eWallets}%`}
        />
        <RateRow
          label="Card (default) MDR"
          value={`${limitsAndMdr.effective.rates.cardDefault}%`}
        />
        <RateRow
          label="Card (Shopify) MDR"
          value={`${limitsAndMdr.effective.rates.cardShopify}%`}
        />
        <RateRow
          label="Payout MDR"
          value={`${limitsAndMdr.effective.rates.payout}%`}
        />
      </ProfileSection>
    </div>
  )
}

function ProfileSection({
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
      <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </CardContent>
    </Card>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function merchantStatusBadge(status: string) {
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
