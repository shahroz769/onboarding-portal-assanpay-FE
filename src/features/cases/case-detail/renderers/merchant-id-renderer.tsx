import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import {
  CreditCard,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Info,
  Save,
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
import { useSaveMidCreationDetails } from '#/hooks/use-case-detail-query'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'
import { cn } from '#/lib/utils'
import { WEBSITE_CMS_OPTIONS } from '#/schemas/merchant-onboarding.schema'

import type { QueueRendererProps } from '../queue-registry'

const SHOPIFY_CARD_RATE = 3.5
const DEFAULT_CARD_RATE = 3
const E_WALLET_QR_RATE = 2.5
const PAYOUT_RATE = 0

const midDetailsSchema = z.object({
  portalMid: z.coerce
    .number({
      error: 'Portal MID is required.',
    })
    .int('Portal MID must be a whole number.')
    .positive('Portal MID must be greater than zero.'),
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

type MidDetailsForm = z.infer<typeof midDetailsSchema>

type FieldErrors = Partial<Record<keyof MidDetailsForm, string>>

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
  const saveMidCreationDetails = useSaveMidCreationDetails(caseId)
  const configurationQuery = useQuery(configurationQueryOptions())
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const canEdit = isCaseOwner && isWorking
  const savedPortalMid = caseDetail.testing?.portalMid ?? null
  const savedCredentialsReady = Boolean(caseDetail.testing?.credentialsReady)

  const merchant = caseDetail.merchant
  const websiteCmsValue = getMerchantString(merchant, 'websiteCms')
  const businessWebsite = getMerchantString(merchant, 'businessWebsite')
  const merchantEmail =
    getMerchantString(merchant, 'businessEmail') ??
    getMerchantString(merchant, 'email') ??
    ''
  const platformLabel = getWebsitePlatformLabel(websiteCmsValue)
  const isShopify = websiteCmsValue === 'shopify'
  const limitsAndMdr = configurationQuery.data?.limitsAndMdr
  const cardRate = isShopify
    ? `${limitsAndMdr?.rates.cardShopify ?? SHOPIFY_CARD_RATE}%`
    : `${limitsAndMdr?.rates.cardDefault ?? DEFAULT_CARD_RATE}%`
  const eWalletRate = `${limitsAndMdr?.rates.eWallets ?? E_WALLET_QR_RATE}%`
  const payoutRate = `${limitsAndMdr?.rates.payout ?? PAYOUT_RATE}%`

  const [form, setForm] = useState<MidDetailsForm>({
    portalMid: savedPortalMid ?? Number.NaN,
    email: merchantEmail,
    password: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [passwordVisible, setPasswordVisible] = useState(false)

  function updateField<TKey extends keyof MidDetailsForm>(
    key: TKey,
    value: MidDetailsForm[TKey],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  async function handleSave() {
    const result = midDetailsSchema.safeParse(form)
    if (!result.success) {
      const nextErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof MidDetailsForm | undefined
        if (path && !nextErrors[path]) {
          nextErrors[path] = issue.message
        }
      }
      setErrors(nextErrors)
      return
    }
    setErrors({})
    await saveMidCreationDetails.mutateAsync(result.data)
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
                Save the credentials created on the merchant platform before
                closing this case successfully. Testing can send these values
                without viewing them.
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
                disabled={!canEdit || saveMidCreationDetails.isPending}
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
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="portal-email">Email</FieldLabel>
              <Input
                id="portal-email"
                type="email"
                autoComplete="off"
                placeholder="merchant@example.com"
                value={form.email}
                disabled={!canEdit || saveMidCreationDetails.isPending}
                aria-invalid={Boolean(errors.email)}
                onChange={(event) => updateField('email', event.target.value)}
              />
              <FieldError>{errors.email}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="portal-password">Password</FieldLabel>
              <InputGroup
                data-disabled={
                  !canEdit || saveMidCreationDetails.isPending
                    ? true
                    : undefined
                }
              >
                <InputGroupInput
                  id="portal-password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  disabled={!canEdit || saveMidCreationDetails.isPending}
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
                        disabled={!canEdit || saveMidCreationDetails.isPending}
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
                onClick={handleSave}
                disabled={!canEdit || saveMidCreationDetails.isPending}
              >
                {saveMidCreationDetails.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {saveMidCreationDetails.isPending ? 'Saving' : 'Save'}
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {savedCredentialsReady ? (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Portal credentials saved</AlertTitle>
          <AlertDescription>
            Merchant portal credentials are saved. You can now mark this case as
            successful.
          </AlertDescription>
        </Alert>
      ) : !canEdit && isWorking ? (
        <Alert>
          <Info />
          <AlertTitle>Owner action required</AlertTitle>
          <AlertDescription>
            Only the current case owner can save the Portal MID.
          </AlertDescription>
        </Alert>
      ) : null}
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
