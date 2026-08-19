import { format } from 'date-fns'
import { Activity, Building2, CalendarClock, Send, Wallet } from 'lucide-react'
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
import { merchantStatusBadgeClasses } from '#/lib/status-styles'
import type { StatusTint } from '#/lib/status-styles'
import type { MerchantDetailResponse } from '#/schemas/merchants.schema'

import { formatNumber, isCaseOpen } from './merchant-detail-helpers'
import { MerchantPaymentMethodDetails } from './merchant-payment-method-details'

type MerchantOverviewTabProps = {
  detail: MerchantDetailResponse
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return '—'
  return format(
    new Date(value),
    withTime ? 'dd MMM yyyy, hh:mm a' : 'dd MMM yyyy',
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
        tone="emerald"
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
              className={merchantStatusBadgeClasses(merchant.status)}
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
        tone="amber"
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
        tone="blue"
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
        tone="sky"
        title="MDR &amp; Limits"
        description={`${activeRatesLabel} · ${
          limitsAndMdr.isOverridden
            ? 'Custom for merchant'
            : 'Global configuration'
        }`}
      >
        <RateRow
          label="Disbursement range"
          value={`${formatNumber(activeRates.disbursementMin)} – ${formatNumber(activeRates.disbursementMax)}`}
        />
        <RateRow
          label="Payout MDR"
          value={`${limitsAndMdr.effective.rates.payout}%`}
        />
        <MerchantPaymentMethodDetails
          methods={detail.paymentMethods}
          className="sm:col-span-2 lg:col-span-3"
        />
      </ProfileSection>

      <ProfileSection
        icon={Send}
        tone="sky"
        title="Payout Methods"
        description="Payout methods saved from MID Creation."
      >
        <MerchantPaymentMethodDetails
          methods={detail.payoutMethods}
          kind="payout"
          className="sm:col-span-2 lg:col-span-3"
        />
      </ProfileSection>
    </div>
  )
}

function ProfileSection({
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
      <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
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
