import { MailCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'

/**
 * Fetches the manual email / WhatsApp preview before its panel is shown.
 * Shared by every case dialog that offers the manual delivery workflows.
 */
export function LoadPreviewButton({
  label,
  pending,
  disabled = false,
  onClick,
  icon: Icon = MailCheck,
  className,
}: {
  label: string
  pending: boolean
  disabled?: boolean
  onClick: () => void
  icon?: LucideIcon
  className?: string
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || pending}
      variant="outline"
      className={className}
    >
      {pending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <Icon data-icon="inline-start" />
      )}
      {pending ? 'Loading preview…' : label}
    </Button>
  )
}
