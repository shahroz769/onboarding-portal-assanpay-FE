import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Info, Mail, MailCheck, Rocket } from 'lucide-react'

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
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { EmailModeChoice } from '#/components/case-email/email-mode-choice'
import { EmailRecipientSelect } from '#/components/case-email/email-recipient-select'
import { ManualEmailPanel } from '#/components/case-email/manual-email-panel'
import { WhatsAppMessagePanel } from '#/components/case-email/whatsapp-message-panel'
import { useAuth } from '#/features/auth/auth-client'
import {
  caseHistoryQueryOptions,
  useConfirmLiveEmailManual,
  useFetchLiveEmailPreview,
  useMarkLiveLimitsApplied,
  useSendLiveEmail,
} from '#/hooks/use-case-detail-query'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'
import type { EmailPreviewResult } from '#/apis/cases'
import type { EmailRecipientType } from '#/schemas/cases.schema'

import type { QueueRendererProps } from '../queue-registry'

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

export default function LiveRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const configurationQuery = useQuery(configurationQueryOptions())
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))
  const markLimitsApplied = useMarkLiveLimitsApplied(caseId)
  const sendLiveEmail = useSendLiveEmail(caseId)
  const fetchPreview = useFetchLiveEmailPreview(caseId)
  const confirmManual = useConfirmLiveEmailManual(caseId)
  const emailMode = configurationQuery.data?.emailSendingMode ?? {
    autoEnabled: true,
    manualEnabled: true,
  }
  const limits = configurationQuery.data?.limitsAndMdr.live
  const paymentMethods = caseDetail.testing?.paymentMethods ?? []
  const payoutMethods = caseDetail.testing?.payoutMethods ?? []
  const merchantPortalUrl =
    configurationQuery.data?.merchantPortal.loginUrl ??
    'https://merchant.assanpay.com/login'
  const limitsAppliedAt = caseDetail.live?.limitsAppliedAt ?? null
  const limitsAppliedBy = caseDetail.live?.limitsAppliedBy?.name ?? null
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const canConfirm = isCaseOwner && isWorking && !limitsAppliedAt
  const liveEmailSent = Boolean(
    historyQuery.data?.some(
      (entry) =>
        entry.action === 'live_activation_email_sent' ||
        entry.action === 'live_activation_email_sent_manual',
    ),
  )
  const canSendLiveEmail =
    isCaseOwner && isWorking && !liveEmailSent && !historyQuery.isPending
  const submitterEmail = getMerchantString(
    caseDetail.merchant,
    'submitterEmail',
  )
  const businessEmail = getMerchantString(caseDetail.merchant, 'businessEmail')
  const activeWhatsappNumber = getMerchantString(
    caseDetail.merchant,
    'activeWhatsappNumber',
  )
  const merchantName =
    getMerchantString(caseDetail.merchant, 'businessName') ?? 'Merchant'

  const [recipientEmailType, setRecipientEmailType] =
    useState<EmailRecipientType>('submitter')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [manualPreview, setManualPreview] = useState<EmailPreviewResult | null>(
    null,
  )

  const emailPreview = buildEmailPreview({
    merchantName,
    merchantPortalUrl,
    liveLimits: limits,
    paymentMethods,
    payoutMethods,
  })

  const selectedEmail =
    recipientEmailType === 'business' ? businessEmail : submitterEmail

  function handleReview() {
    if (!selectedEmail) return
    setReviewOpen(true)
  }

  function openReview() {
    setManualPreview(null)
    handleReview()
  }

  async function handleSendMail() {
    await sendLiveEmail.mutateAsync({ recipientEmailType })
    setManualPreview(null)
  }

  async function handleLoadManualPreview() {
    const data = await fetchPreview.mutateAsync({ recipientEmailType })
    setManualPreview(data)
  }

  async function handleManualConfirm(
    file: File,
    channel: 'email' | 'whatsapp',
  ) {
    if (!manualPreview) return
    await confirmManual.mutateAsync({
      tokenId: manualPreview.tokenId,
      file,
      channel,
      recipientEmailType,
    })
    if (channel === 'whatsapp') setReviewOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Live Limits</CardTitle>
              <CardDescription>
                Confirm the merchant live limits before closing this case.
              </CardDescription>
            </div>
            <Badge variant={limitsAppliedAt ? 'secondary' : 'outline'}>
              {limitsAppliedAt ? <CheckCircle2 /> : <Rocket />}
              {limitsAppliedAt ? 'Applied' : 'Pending'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            {paymentMethods.map((method) => (
              <LimitBlock
                key={method.id}
                label={`${method.label} collection`}
                value={`${method.live.min.toLocaleString()}-${method.live.max.toLocaleString()}`}
              />
            ))}

            {payoutMethods.length > 0 ? (
              payoutMethods.map((method) => (
                <LimitBlock
                  key={method.id}
                  label={`${method.label} payout`}
                  value={`${method.live.min.toLocaleString()}-${method.live.max.toLocaleString()}`}
                />
              ))
            ) : (
              <LimitBlock
                label="Disbursement"
                value={`${limits?.disbursementMin ?? 1000}-${limits?.disbursementMax ?? 50000}`}
              />
            )}
          </div>

          <FieldGroup>
            <Field orientation="horizontal" data-disabled={!canConfirm}>
              <Checkbox
                id="live-limits-applied"
                checked={Boolean(limitsAppliedAt)}
                disabled={!canConfirm || markLimitsApplied.isPending}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    markLimitsApplied.mutate()
                  }
                }}
              />

              <FieldContent>
                <FieldLabel htmlFor="live-limits-applied">
                  I have applied the live limits
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
            <Alert variant="success">
              <CheckCircle2 />
              <AlertTitle>Limits applied</AlertTitle>
              <AlertDescription>
                Confirmed{limitsAppliedBy ? ` by ${limitsAppliedBy}` : ''}. The
                case can now be marked as successful.
              </AlertDescription>
            </Alert>
          ) : !canConfirm && isWorking ? (
            <Alert variant="warning">
              <Info />
              <AlertTitle>Owner action required</AlertTitle>
              <AlertDescription>
                Only the current case owner can confirm that live limits were
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
              <CardTitle>Send Live Mail</CardTitle>
              <CardDescription>
                Tell the merchant they are live and share the live limits.
              </CardDescription>
            </div>
            <Badge variant={liveEmailSent ? 'secondary' : 'outline'}>
              {liveEmailSent ? <MailCheck /> : <Mail />}
              {liveEmailSent ? 'Sent' : 'Ready'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <EmailRecipientSelect
              value={recipientEmailType}
              onValueChange={(value) => {
                setRecipientEmailType(value)
                setManualPreview(null)
              }}
              submitterEmail={submitterEmail}
              businessEmail={businessEmail}
              disabled={!canSendLiveEmail || sendLiveEmail.isPending}
            />

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                onClick={openReview}
                disabled={
                  !canSendLiveEmail || !selectedEmail || sendLiveEmail.isPending
                }
              >
                <Mail data-icon="inline-start" />
                Review &amp; Send mail
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {liveEmailSent ? (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>Live email already sent</AlertTitle>
          <AlertDescription>
            The merchant was notified that the account is live.
          </AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review email</DialogTitle>
            <DialogDescription>
              Confirm the live activation email before sending it to the client.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid gap-2 rounded-lg border bg-muted/30 px-3 py-3 text-sm">
              <PreviewRow label="To" value={selectedEmail ?? '-'} />
              <PreviewRow label="Subject" value={emailPreview.subject} />
            </div>
            <div className="rounded-lg border bg-background">
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap px-4 py-3 text-sm leading-6">
                {emailPreview.body}
              </pre>
            </div>
          </div>

          <EmailModeChoice
            mode={emailMode}
            autoContent={
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setReviewOpen(false)}
                  disabled={sendLiveEmail.isPending}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSendMail}
                  disabled={sendLiveEmail.isPending || liveEmailSent}
                >
                  {sendLiveEmail.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <MailCheck data-icon="inline-start" />
                  )}
                  {sendLiveEmail.isPending
                    ? 'Sending mail'
                    : 'Send mail to client'}
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
                  {fetchPreview.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <MailCheck data-icon="inline-start" />
                  )}
                  {fetchPreview.isPending
                    ? 'Loading preview...'
                    : 'Load email preview'}
                </Button>
              ) : (
                <ManualEmailPanel
                  preview={manualPreview}
                  onConfirm={(file) => handleManualConfirm(file, 'email')}
                  isPending={confirmManual.isPending}
                />
              )
            }
            whatsappContent={
              !manualPreview ? (
                <Button
                  onClick={handleLoadManualPreview}
                  disabled={fetchPreview.isPending}
                  variant="outline"
                  className="w-full"
                >
                  {fetchPreview.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <MailCheck data-icon="inline-start" />
                  )}
                  {fetchPreview.isPending
                    ? 'Loading preview...'
                    : 'Load WhatsApp message'}
                </Button>
              ) : (
                <WhatsAppMessagePanel
                  preview={manualPreview}
                  phoneNumber={activeWhatsappNumber}
                  onConfirm={(file) => handleManualConfirm(file, 'whatsapp')}
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
  merchantPortalUrl,
  liveLimits,
  paymentMethods,
  payoutMethods,
}: {
  merchantName: string
  merchantPortalUrl: string
  liveLimits?: {
    collectionMin: number
    collectionMax: number
    disbursementMin: number
    disbursementMax: number
  }
  paymentMethods: NonNullable<
    QueueRendererProps['caseDetail']['testing']
  >['paymentMethods'] extends infer T
    ? NonNullable<T>
    : never
  payoutMethods: NonNullable<
    QueueRendererProps['caseDetail']['testing']
  >['payoutMethods'] extends infer T
    ? NonNullable<T>
    : never
}) {
  const subject = `AssanPay account is live for ${merchantName}`
  const methodCommissionLines = [...paymentMethods, ...payoutMethods]
    .map((method) => `- ${method.label}: ${method.commissionRate}%`)
    .join('\n')
  const body = `AssanPay account is live for ${merchantName}

Congratulations, ${merchantName}. Your AssanPay merchant account is live now and ready for production transactions.

Merchant Portal Link: ${merchantPortalUrl}

Live Limits Per Transaction
${paymentMethods.map((method) => `- ${method.label} collection: PKR ${method.live.min.toLocaleString()}-${method.live.max.toLocaleString()}`).join('\n')}
${payoutMethods.length > 0 ? payoutMethods.map((method) => `- ${method.label} payout: PKR ${method.live.min.toLocaleString()}-${method.live.max.toLocaleString()}`).join('\n') : `- Disbursement: PKR ${liveLimits?.disbursementMin ?? 1000}-${liveLimits?.disbursementMax ?? 50000}`}

${methodCommissionLines ? `Applicable Commission\n${methodCommissionLines}\n` : ''}

You can use the merchant portal to monitor live activity and manage your AssanPay merchant account.

If you need any help, just reply to this email.

- AssanPay Onboarding Team`

  return { subject, body }
}
