import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2,
  Clock3,
  MailCheck,
  MailWarning,
  ShieldOff,
  TriangleAlert,
} from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { cn } from '#/lib/utils'
import { statusTint } from '#/lib/status-styles'
import type { StatusTint } from '#/lib/status-styles'
import type { EmailDeliveryStatus } from '#/schemas/cases.schema'

type DeliveryMeta = {
  label: string
  tint: StatusTint
  icon: LucideIcon
  /** What the status means, shown on hover. */
  description: string
}

const DELIVERY_META: Record<EmailDeliveryStatus, DeliveryMeta> = {
  queued: {
    label: 'Sending',
    tint: 'neutral',
    icon: Clock3,
    description: 'Handing the email to Resend.',
  },
  sent: {
    label: 'Awaiting delivery',
    tint: 'sky',
    icon: Clock3,
    description:
      "Resend accepted the email; the recipient's mail server hasn't confirmed it yet.",
  },
  delivery_delayed: {
    label: 'Delayed',
    tint: 'amber',
    icon: Clock3,
    description:
      'Delivery hit a temporary problem. Resend keeps retrying for a while.',
  },
  delivered: {
    label: 'Delivered',
    tint: 'emerald',
    icon: CheckCircle2,
    description: "The recipient's mail server accepted the email.",
  },
  bounced: {
    label: 'Bounced',
    tint: 'red',
    icon: MailWarning,
    description: "The recipient's mail server rejected the email.",
  },
  complained: {
    label: 'Marked as spam',
    tint: 'red',
    icon: TriangleAlert,
    description:
      'The email was delivered, but the recipient marked it as spam.',
  },
  suppressed: {
    label: 'Suppressed',
    tint: 'red',
    icon: ShieldOff,
    description:
      'Not sent: the address is on the suppression list after an earlier bounce or spam complaint.',
  },
  failed: {
    label: 'Failed',
    tint: 'red',
    icon: MailWarning,
    description: 'The email could not be sent.',
  },
}

const UPDATED_AT_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * Resend delivery status of a case email, with the meaning, any provider
 * detail (e.g. the bounce reason) and the time on hover. Emails sent before
 * delivery tracking (`tracked = false`) only ever show as Sent.
 */
export function EmailDeliveryBadge({
  status,
  detail,
  updatedAt,
  tracked = true,
  className,
}: {
  status: EmailDeliveryStatus
  detail?: string | null
  updatedAt?: string | null
  tracked?: boolean
  className?: string
}) {
  const meta: DeliveryMeta =
    !tracked && status === 'sent'
      ? {
          label: 'Sent',
          tint: 'neutral',
          icon: MailCheck,
          description:
            'Sent before delivery tracking was enabled, so delivery is unknown.',
        }
      : DELIVERY_META[status]
  const Icon = meta.icon

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="secondary"
            className={cn(statusTint(meta.tint), 'gap-1', className)}
          />
        }
      >
        <Icon className="size-3" aria-hidden="true" />
        {meta.label}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{meta.description}</p>
        {detail ? <p className="mt-1 opacity-80">{detail}</p> : null}
        {updatedAt ? (
          <p className="mt-1 opacity-60">
            {UPDATED_AT_FORMAT.format(new Date(updatedAt))}
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}
