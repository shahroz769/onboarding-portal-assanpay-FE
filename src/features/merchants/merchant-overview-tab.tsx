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
import type { MerchantOverviewResponse } from '#/schemas/merchants.schema'

import { formatNumber } from './merchant-detail-helpers'
import { MerchantPaymentMethodDetails } from './merchant-payment-method-details'

type MerchantOverviewTabProps = {
  detail: MerchantOverviewResponse
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return '—'
  return format(
    new Date(value),
    withTime ? 'dd MMM yyyy, hh:mm a' : 'dd MMM yyyy',
  )
}

export function MerchantOverviewTab({ detail }: MerchantOverviewTabProps) {
  const { merchant, caseCounts, milestones, limitsAndMdr } = detail

  const activeRates =
    merchant.status === 'live'
      ? limitsAndMdr.effective.live
      : limitsAndMdr.effective.testing
  const activeRatesLabel =
    merchant.status === 'live' ? 'Live limits' : 'Testing limits'

  // Two cards per row on wide screens; Profile spans the full row.
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ProfileSection
        icon={Building2}
        tone="emerald"
        title="Profile"
        className="xl:col-span-2"
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
          label="Form filled"
          value={formatDate(milestones.formFilledAt, true)}
        />
        <Detail
          label="Testing started"
          value={formatDate(milestones.testStartedAt, true)}
        />
        <Detail label="Went live" value={formatDate(milestones.liveAt, true)} />
        <Detail
          label="Last updated"
          value={formatDate(merchant.updatedAt, true)}
        />
      </ProfileSection>

      <ProfileSection
        icon={Activity}
        tone="blue"
        title="Cases"
        description="Workflow case counts and current SLA signal."
      >
        <Detail label="Total cases" value={caseCounts.total} />
        <Detail label="Open" value={caseCounts.open} />
        <Detail label="Working" value={caseCounts.working} />
        <Detail label="Closed" value={caseCounts.closed} />
        <Detail label="SLA breached" value={caseCounts.slaBreached} />
      </ProfileSection>

      <ProfileSection
        icon={Wallet}
        tone="sky"
        title="MDR and limits"
        description={`${activeRatesLabel} · ${
          limitsAndMdr.isOverridden
            ? 'Custom for merchant'
            : 'Global configuration'
        }`}
        after={
          <MerchantPaymentMethodDetails
            methods={detail.paymentMethods}
            currency={merchant.currency}
          />
        }
      >
        <RateRow
          label="Disbursement range"
          value={`${merchant.currency} ${formatNumber(activeRates.disbursementMin)} – ${formatNumber(activeRates.disbursementMax)}`}
        />
        <RateRow
          label="Payout MDR"
          value={`${limitsAndMdr.effective.rates.payout}%`}
        />
      </ProfileSection>

      <ProfileSection
        icon={Send}
        tone="sky"
        title="Payout methods"
        description="Payout methods saved from MID Creation."
        after={
          <MerchantPaymentMethodDetails
            methods={detail.payoutMethods}
            currency={merchant.currency}
            kind="payout"
          />
        }
      />
    </div>
  )
}

function ProfileSection({
  icon,
  tone,
  title,
  description,
  children,
  after,
  className,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: StatusTint
  title: string
  description: string
  /** Label/value pairs (`Detail`, `RateRow`), rendered as a description list. */
  children?: ReactNode
  /** Content below the pairs, such as the payment method cards. */
  after?: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <SectionIcon icon={icon} tone={tone} />
          <div>
            <CardTitle render={<h2 />}>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      {/* Columns follow the card's width, not the viewport: a card can be
          full width or half width. */}
      <CardContent className="@container flex flex-col gap-5">
        {children ? (
          <dl className="grid gap-x-8 gap-y-5 @md:grid-cols-2 @3xl:grid-cols-3">
            {children}
          </dl>
        ) : null}
        {after}
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
