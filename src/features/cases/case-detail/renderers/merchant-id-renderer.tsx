import { useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import {
  CreditCard,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Info,
  KeyRound,
  Mail,
  MailCheck,
  Send,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { z } from 'zod'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#/components/ui/input-group'
import { Spinner } from '#/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useAuth } from '#/features/auth/auth-client'
import {
  caseHistoryQueryOptions,
  useSendMidCreationEmail,
} from '#/hooks/use-case-detail-query'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'
import { cn } from '#/lib/utils'
import { WEBSITE_CMS_OPTIONS } from '#/schemas/merchant-onboarding.schema'

import type { QueueRendererProps } from '../queue-registry'

const MERCHANT_PORTAL_LOGIN_URL = 'https://merchant.assanpay.com/login'
const SHOPIFY_CARD_RATE = 3.5
const DEFAULT_CARD_RATE = 3
const E_WALLET_QR_RATE = 2.5
const PAYOUT_RATE = 0

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Enter a valid email.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password is too long.'),
  portalMid: z.coerce
    .number({
      error: 'Portal MID is required.',
    })
    .int('Portal MID must be a whole number.')
    .positive('Portal MID must be greater than zero.'),
})

type CredentialsForm = z.infer<typeof credentialsSchema>

type FieldErrors = Partial<Record<keyof CredentialsForm, string>>

function getMerchantString(
  merchant: Record<string, unknown>,
  key: string,
): string | null {
  const value = merchant[key]
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }
  return null
}

function getWebsitePlatformLabel(value: string | null): string {
  if (!value) return 'Not provided'
  const match = WEBSITE_CMS_OPTIONS.find((option) => option.value === value)
  return match?.label ?? value
}

export default function MerchantIdRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const sendMidCreationEmail = useSendMidCreationEmail(caseId)
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))
  const configurationQuery = useQuery(configurationQueryOptions())
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const credentialsEmailSent = Boolean(
    historyQuery.data?.some(
      (entry) => entry.action === 'mid_creation_email_sent',
    ),
  )
  const isCheckingCredentialsEmail = historyQuery.isPending
  const canEdit =
    isCaseOwner &&
    isWorking &&
    !credentialsEmailSent &&
    !isCheckingCredentialsEmail

  const merchant = caseDetail.merchant
  const websiteCmsValue = getMerchantString(merchant, 'websiteCms')
  const businessWebsite = getMerchantString(merchant, 'businessWebsite')
  const platformLabel = getWebsitePlatformLabel(websiteCmsValue)
  const isShopify = websiteCmsValue === 'shopify'
  const limitsAndMdr = configurationQuery.data?.limitsAndMdr
  const linkDeadlines = configurationQuery.data?.linkDeadlines
  const cardRate = isShopify
    ? `${limitsAndMdr?.rates.cardShopify ?? SHOPIFY_CARD_RATE}%`
    : `${limitsAndMdr?.rates.cardDefault ?? DEFAULT_CARD_RATE}%`
  const eWalletRate = `${limitsAndMdr?.rates.eWallets ?? E_WALLET_QR_RATE}%`
  const payoutRate = `${limitsAndMdr?.rates.payout ?? PAYOUT_RATE}%`
  const goLiveDelayHours = linkDeadlines?.goLiveAvailabilityHours ?? 72

  const merchantEmail =
    getMerchantString(merchant, 'email') ??
    getMerchantString(merchant, 'businessEmail') ??
    ''

  const [form, setForm] = useState<CredentialsForm>({
    email: merchantEmail,
    password: '',
    portalMid: Number.NaN,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [reviewOpen, setReviewOpen] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)

  const merchantName = getMerchantString(merchant, 'businessName') ?? 'Merchant'

  const emailPreview = useMemo(
    () =>
      buildEmailPreview({
        merchantName,
        email: form.email,
        password: form.password,
        limitsAndMdr,
        goLiveDelayHours,
      }),
    [merchantName, form.email, form.password, limitsAndMdr, goLiveDelayHours],
  )

  function updateField<TKey extends keyof CredentialsForm>(
    key: TKey,
    value: CredentialsForm[TKey],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  function handleReview() {
    const result = credentialsSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof CredentialsForm | undefined
        if (path && !nextErrors[path]) {
          nextErrors[path] = issue.message
        }
      }
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setReviewOpen(true)
  }

  async function handleSendMail() {
    await sendMidCreationEmail.mutateAsync(form)
    setReviewOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Merchant Platform</CardTitle>
              <CardDescription>
                Website platform / CMS submitted by the merchant during
                onboarding.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              <Globe />
              {platformLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Website Platform / CMS</FieldLabel>
              <ReadonlyValue>{platformLabel}</ReadonlyValue>
            </Field>
            <Field>
              <FieldLabel>Business Website</FieldLabel>
              <ReadonlyValue>
                {businessWebsite ? (
                  <a
                    href={businessWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {businessWebsite}
                  </a>
                ) : (
                  'Not provided'
                )}
              </ReadonlyValue>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rates</CardTitle>
          <CardDescription>
            Standard MID rates applied to this merchant. Card rate adjusts for
            Shopify integrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <RateGroup
              icon={<Wallet className="size-4" />}
              title="Payin Rates"
              rows={[
                { label: 'E-Wallets & QR', value: eWalletRate },
                {
                  label: isShopify ? 'Card (Shopify)' : 'Card',
                  value: cardRate,
                  highlight: true,
                },
              ]}
            />
            <RateGroup
              icon={<Send className="size-4" />}
              title="Payout Rates"
              rows={[{ label: 'Disbursement', value: payoutRate }]}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Merchant Portal Credentials</CardTitle>
              <CardDescription>
                Enter the credentials that will be shared with the client. You
                can review the email before sending.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              <ShieldCheck />
              Owner only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="mid-email">Email</FieldLabel>
              <Input
                id="mid-email"
                type="email"
                autoComplete="off"
                placeholder="merchant@example.com"
                value={form.email}
                disabled={!canEdit || sendMidCreationEmail.isPending}
                aria-invalid={Boolean(errors.email)}
                onChange={(event) => updateField('email', event.target.value)}
              />
              <FieldError>{errors.email}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="mid-password">Password</FieldLabel>
              <InputGroup
                data-disabled={
                  !canEdit || sendMidCreationEmail.isPending ? true : undefined
                }
              >
                <InputGroupInput
                  id="mid-password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  disabled={!canEdit || sendMidCreationEmail.isPending}
                  aria-invalid={Boolean(errors.password)}
                  onChange={(event) =>
                    updateField('password', event.target.value)
                  }
                />
                <InputGroupAddon align="inline-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InputGroupButton
                        aria-label={
                          passwordVisible ? 'Hide password' : 'Show password'
                        }
                        disabled={!canEdit || sendMidCreationEmail.isPending}
                        size="icon-xs"
                        onClick={() =>
                          setPasswordVisible((current) => !current)
                        }
                      >
                        {passwordVisible ? <EyeOff /> : <Eye />}
                      </InputGroupButton>
                    </TooltipTrigger>
                    <TooltipContent>
                      {passwordVisible ? 'Hide password' : 'Show password'}
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
              <FieldError>{errors.password}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.portalMid)}>
              <FieldLabel htmlFor="portal-mid">Portal MID</FieldLabel>
              <Input
                id="portal-mid"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="Enter Portal MID"
                value={Number.isFinite(form.portalMid) ? form.portalMid : ''}
                disabled={!canEdit || sendMidCreationEmail.isPending}
                aria-invalid={Boolean(errors.portalMid)}
                onChange={(event) =>
                  updateField(
                    'portalMid',
                    event.target.value === ''
                      ? Number.NaN
                      : Number(event.target.value),
                  )
                }
              />
              <FieldError>{errors.portalMid}</FieldError>
            </Field>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                onClick={handleReview}
                disabled={!canEdit || sendMidCreationEmail.isPending}
              >
                <Mail data-icon="inline-start" />
                Review &amp; Send mail
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {!canEdit && isWorking && !isCheckingCredentialsEmail ? (
        <Alert>
          {credentialsEmailSent ? <CheckCircle2 /> : <Info />}
          <AlertTitle>
            {credentialsEmailSent
              ? 'Credentials email already sent'
              : 'Owner action required'}
          </AlertTitle>
          <AlertDescription>
            {credentialsEmailSent
              ? 'MID credentials can only be sent once from this screen.'
              : 'Only the current case owner can issue MID credentials and send the onboarding email.'}
          </AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review email</DialogTitle>
            <DialogDescription>
              Confirm the credentials and email content before sending it to the
              client.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid gap-2 rounded-lg border bg-muted/30 px-3 py-3 text-sm">
              <PreviewRow label="To" value={form.email || '-'} />
              <PreviewRow
                label="Portal MID"
                value={
                  Number.isFinite(form.portalMid) ? String(form.portalMid) : '-'
                }
              />
              <PreviewRow label="Subject" value={emailPreview.subject} />
            </div>
            <div className="rounded-lg border bg-background">
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap px-4 py-3 text-sm leading-6">
                {emailPreview.body}
              </pre>
            </div>
            <Alert>
              <KeyRound />
              <AlertTitle>Go-Live link</AlertTitle>
              <AlertDescription>
                The email includes a Go-Live link that becomes active{' '}
                {goLiveDelayHours} hours after delivery. Clicking the link
                before that window only shows the instructions.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewOpen(false)}
              disabled={sendMidCreationEmail.isPending}
            >
              Back
            </Button>
            <Button
              onClick={handleSendMail}
              disabled={sendMidCreationEmail.isPending || credentialsEmailSent}
            >
              {sendMidCreationEmail.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <MailCheck data-icon="inline-start" />
              )}
              {sendMidCreationEmail.isPending
                ? 'Sending mail'
                : 'Send mail to client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReadonlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm">
      {children}
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="wrap-break-word text-sm">{value}</span>
    </div>
  )
}

function RateGroup({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode
  title: string
  rows: Array<{ label: string; value: string; highlight?: boolean }>
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      <div className="flex flex-col divide-y">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-2 text-sm"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              {row.label === 'Card' || row.label.startsWith('Card') ? (
                <CreditCard className="size-3.5" />
              ) : null}
              {row.label}
            </span>
            <span
              className={cn(
                'font-mono text-sm font-semibold',
                row.highlight && 'text-primary',
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildEmailPreview({
  merchantName,
  email,
  password,
  limitsAndMdr,
  goLiveDelayHours,
}: {
  merchantName: string
  email: string
  password: string
  limitsAndMdr?: {
    testing: {
      collectionMin: number
      collectionMax: number
      disbursementMin: number
      disbursementMax: number
    }
    rates: {
      eWallets: number
      cardDefault: number
      payout: number
    }
  }
  goLiveDelayHours: number
}) {
  const subject = `Welcome to AssanPay - Your Merchant Portal Credentials`
  const credentialsBlock =
    email || password
      ? `Email: ${email || '-'}\nPassword: ${password || '-'}`
      : `Email: -\nPassword: -`

  const body = `Hi ${merchantName},

Welcome aboard AssanPay. Your merchant account is ready and your testing environment has been provisioned.

Merchant Portal Link: ${MERCHANT_PORTAL_LOGIN_URL}

Login Credentials
${credentialsBlock}

Testing Limits Per Transaction
- Collection: ${limitsAndMdr?.testing.collectionMin ?? 10}-${limitsAndMdr?.testing.collectionMax ?? 100}
- Disbursement: ${limitsAndMdr?.testing.disbursementMin ?? 1000}-${limitsAndMdr?.testing.disbursementMax ?? 50000}

Applicable Rates
- E-Wallets & QR: ${limitsAndMdr?.rates.eWallets ?? 2.5}% + Tax
- Card: ${limitsAndMdr?.rates.cardDefault ?? 3}% + Tax
- Bank Settlement: ${limitsAndMdr?.rates.payout ?? 0}%

Go-Live
Once you have completed your testing, use the Go-Live button below to start the live activation process. The link works after ${goLiveDelayHours} hours only. Until then, it will show these instructions only.

Go-Live Button Link: <will be generated when sending>

If you need any help, just reply to this email.

- AssanPay Onboarding Team`

  return { subject, body }
}
