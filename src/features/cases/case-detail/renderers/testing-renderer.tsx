import { useMemo, useState } from 'react'

import {
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  Info,
  KeyRound,
  Mail,
  MailCheck,
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
import { Checkbox } from '#/components/ui/checkbox'
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
  FieldContent,
  FieldDescription,
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
  useMarkTestingLimitsApplied,
  useSendMidCreationEmail,
  useFetchMidCreationEmailPreview,
  useConfirmMidCreationEmailManual,
} from '#/hooks/use-case-detail-query'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'
import { useQuery } from '@tanstack/react-query'
import { EmailModeChoice } from '#/components/case-email/email-mode-choice'
import { ManualEmailPanel } from '#/components/case-email/manual-email-panel'
import type { EmailPreviewResult } from '#/apis/cases'

import type { QueueRendererProps } from '../queue-registry'

const MERCHANT_PORTAL_LOGIN_URL = 'https://merchant.assanpay.com/login'

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

export default function TestingRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const configurationQuery = useQuery(configurationQueryOptions())
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))
  const markLimitsApplied = useMarkTestingLimitsApplied(caseId)
  const sendCredentialsEmail = useSendMidCreationEmail(caseId)
  const fetchPreview = useFetchMidCreationEmailPreview(caseId)
  const confirmManual = useConfirmMidCreationEmailManual(caseId)
  const emailMode = configurationQuery.data?.emailSendingMode ?? { autoEnabled: true, manualEnabled: true }
  const limits = configurationQuery.data?.limitsAndMdr.testing
  const limitsAndMdr = configurationQuery.data?.limitsAndMdr
  const linkDeadlines = configurationQuery.data?.linkDeadlines
  const limitsAppliedAt = caseDetail.testing?.limitsAppliedAt ?? null
  const limitsAppliedBy = caseDetail.testing?.limitsAppliedBy?.name ?? null
  const portalMid = caseDetail.testing?.portalMid ?? null
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const canConfirm = isCaseOwner && isWorking && !limitsAppliedAt
  const credentialsEmailSent = Boolean(
    historyQuery.data?.some(
      (entry) => entry.action === 'mid_creation_email_sent',
    ),
  )
  const canSendCredentials =
    isCaseOwner &&
    isWorking &&
    portalMid != null &&
    !credentialsEmailSent &&
    !historyQuery.isPending
  const merchantEmail =
    getMerchantString(caseDetail.merchant, 'email') ??
    getMerchantString(caseDetail.merchant, 'businessEmail') ??
    ''
  const merchantName =
    getMerchantString(caseDetail.merchant, 'businessName') ?? 'Merchant'
  const goLiveDelayHours = linkDeadlines
    ? linkDeadlines.goLiveAvailabilityHours
    : 72
  const goLiveAvailabilityText =
    goLiveDelayHours == null ? 'immediately' : `${goLiveDelayHours} hours after delivery`

  const [form, setForm] = useState<CredentialsForm>({
    email: merchantEmail,
    password: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [reviewOpen, setReviewOpen] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [manualPreview, setManualPreview] = useState<EmailPreviewResult | null>(null)

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
    if (portalMid == null) return
    await sendCredentialsEmail.mutateAsync({ ...form, portalMid })
    setReviewOpen(false)
  }

  function openReview() {
    setManualPreview(null)
    handleReview()
  }

  async function handleLoadManualPreview() {
    if (portalMid == null) return
    const data = await fetchPreview.mutateAsync({ ...form, portalMid })
    setManualPreview(data)
  }

  async function handleManualConfirm(file: File) {
    if (!manualPreview || portalMid == null) return
    await confirmManual.mutateAsync({ tokenId: manualPreview.tokenId, file, ...form, portalMid })
    setReviewOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Testing Limits</CardTitle>
              <CardDescription>
                Confirm the merchant testing limits before closing this case.
              </CardDescription>
            </div>
            <Badge variant={limitsAppliedAt ? 'secondary' : 'outline'}>
              {limitsAppliedAt ? <CheckCircle2 /> : <FlaskConical />}
              {limitsAppliedAt ? 'Applied' : 'Pending'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {portalMid != null ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Portal MID</span>
              <span className="ml-auto font-mono text-sm font-semibold">
                {portalMid}
              </span>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <LimitBlock
              label="Collection"
              value={`${limits?.collectionMin ?? 10}-${limits?.collectionMax ?? 100}`}
            />
            <LimitBlock
              label="Disbursement"
              value={`${limits?.disbursementMin ?? 1000}-${limits?.disbursementMax ?? 50000}`}
            />
          </div>

          <FieldGroup>
            <Field orientation="horizontal" data-disabled={!canConfirm}>
              <Checkbox
                id="testing-limits-applied"
                checked={Boolean(limitsAppliedAt)}
                disabled={!canConfirm || markLimitsApplied.isPending}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    markLimitsApplied.mutate()
                  }
                }}
              />
              <FieldContent>
                <FieldLabel htmlFor="testing-limits-applied">
                  I have applied the testing limits
                </FieldLabel>
                <FieldDescription>
                  Mark as successful is available after this confirmation is
                  saved.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>

          {markLimitsApplied.isPending ? (
            <Button disabled variant="outline">
              <Spinner data-icon="inline-start" />
              Saving confirmation
            </Button>
          ) : null}

          {limitsAppliedAt ? (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Limits applied</AlertTitle>
              <AlertDescription>
                Confirmed{limitsAppliedBy ? ` by ${limitsAppliedBy}` : ''}. The
                case can now be marked as successful.
              </AlertDescription>
            </Alert>
          ) : !canConfirm && isWorking ? (
            <Alert>
              <Info />
              <AlertTitle>Owner action required</AlertTitle>
              <AlertDescription>
                Only the current case owner can confirm that testing limits were
                applied.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Send Credentials Mail</CardTitle>
              <CardDescription>
                Send the merchant portal credentials and Go-Live link after the
                Portal MID is available.
              </CardDescription>
            </div>
            <Badge variant={credentialsEmailSent ? 'secondary' : 'outline'}>
              {credentialsEmailSent ? <MailCheck /> : <Mail />}
              {credentialsEmailSent ? 'Sent' : 'Ready'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="testing-credentials-email">Email</FieldLabel>
              <Input
                id="testing-credentials-email"
                type="email"
                autoComplete="off"
                placeholder="merchant@example.com"
                value={form.email}
                disabled={!canSendCredentials || sendCredentialsEmail.isPending}
                aria-invalid={Boolean(errors.email)}
                onChange={(event) => updateField('email', event.target.value)}
              />
              <FieldError>{errors.email}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="testing-credentials-password">
                Password
              </FieldLabel>
              <InputGroup
                data-disabled={
                  !canSendCredentials || sendCredentialsEmail.isPending
                    ? true
                    : undefined
                }
              >
                <InputGroupInput
                  id="testing-credentials-password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  disabled={
                    !canSendCredentials || sendCredentialsEmail.isPending
                  }
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
                        disabled={
                          !canSendCredentials || sendCredentialsEmail.isPending
                        }
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

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                onClick={openReview}
                disabled={!canSendCredentials || sendCredentialsEmail.isPending}
              >
                <Mail data-icon="inline-start" />
                Review &amp; Send mail
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {portalMid == null && isWorking ? (
        <Alert>
          <Info />
          <AlertTitle>Portal MID required</AlertTitle>
          <AlertDescription>
            Save the Portal MID in the MID Creation case before sending
            credentials from Testing.
          </AlertDescription>
        </Alert>
      ) : credentialsEmailSent ? (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Credentials email already sent</AlertTitle>
          <AlertDescription>
            Merchant portal credentials were sent for this Testing case.
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
                value={portalMid == null ? '-' : String(portalMid)}
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
                {goLiveAvailabilityText}. The signed physical agreement must
                be submitted to AssanPay Head Office before Go-Live can proceed.
              </AlertDescription>
            </Alert>
          </div>

          <EmailModeChoice
            mode={emailMode}
            autoContent={
              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={sendCredentialsEmail.isPending}>
                  Back
                </Button>
                <Button onClick={handleSendMail} disabled={sendCredentialsEmail.isPending || credentialsEmailSent}>
                  {sendCredentialsEmail.isPending ? <Spinner data-icon="inline-start" /> : <MailCheck data-icon="inline-start" />}
                  {sendCredentialsEmail.isPending ? 'Sending mail' : 'Send mail to client'}
                </Button>
              </DialogFooter>
            }
            manualContent={
              !manualPreview ? (
                <Button
                  onClick={handleLoadManualPreview}
                  disabled={fetchPreview.isPending}
                  variant="outline"
                  className="w-full"
                >
                  {fetchPreview.isPending ? <Spinner data-icon="inline-start" /> : <MailCheck data-icon="inline-start" />}
                  {fetchPreview.isPending ? 'Loading preview…' : 'Load email preview'}
                </Button>
              ) : (
                <ManualEmailPanel
                  preview={manualPreview}
                  onConfirm={handleManualConfirm}
                  isPending={confirmManual.isPending}
                />
              )
            }
          />
        </DialogContent>
      </Dialog>
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

function LimitBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-lg font-semibold">{value}</span>
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
  goLiveDelayHours: number | null
}) {
  const subject = `Welcome to AssanPay - Your Merchant Portal Credentials`
  const goLiveAvailabilitySentence =
    goLiveDelayHours == null
      ? 'The link is available immediately.'
      : `The link works after ${goLiveDelayHours} hours only. Until then, it will show these instructions only.`
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
Once you have completed your testing, use the Go-Live button below to start the live activation process. ${goLiveAvailabilitySentence}

Before Go-Live can proceed, send the signed physical agreement to AssanPay Head Office. This physical agreement copy is required for live activation.

Go-Live Button Link: <will be generated when sending>

If you need any help, just reply to this email.

- AssanPay Onboarding Team`

  return { subject, body }
}
