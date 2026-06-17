import { useEffect, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import {
  CreditCard,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Info,
  Landmark,
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
import { Checkbox } from '#/components/ui/checkbox'
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
import { paymentMethodSettingsSchema } from '#/schemas/configuration.schema'
import type { PaymentMethodSettings } from '#/schemas/configuration.schema'
import { WEBSITE_CMS_OPTIONS } from '#/schemas/merchant-onboarding.schema'

import type { QueueRendererProps } from '../queue-registry'

const SHOPIFY_CARD_RATE = 3.5
const DEFAULT_CARD_RATE = 3
const E_WALLET_QR_RATE = 2.5
const PAYOUT_RATE = 0
const DEFAULT_METHODS: PaymentMethodSettings = []

const midDetailsSchema = z.object({
  portalMid: z.coerce
    .number({
      error: 'Portal MID is required.',
    })
    .int('Portal MID must be a whole number.')
    .positive('Portal MID must be greater than zero.'),
  portalMuid: z
    .string()
    .trim()
    .min(1, 'Portal MUID is required.')
    .uuid('Portal MUID must be a valid UUID.'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Enter a valid email.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password is too long.'),
  paymentMethods: paymentMethodSettingsSchema.min(
    1,
    'Select at least one payment method.',
  ),
  payoutMethods: paymentMethodSettingsSchema.min(
    1,
    'Select at least one payout method.',
  ),
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
  const configurationQuery = useQuery(configurationQueryOptions())
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const canEdit = isCaseOwner && isWorking
  const savedPortalMid = caseDetail.testing?.portalMid ?? null
  const savedPortalMuid = caseDetail.testing?.portalMuid ?? null
  const savedCredentialsReady = Boolean(caseDetail.testing?.credentialsReady)
  const savedPaymentMethods = savedCredentialsReady
    ? (caseDetail.testing?.paymentMethods ?? null)
    : null
  const savedPayoutMethods = savedCredentialsReady
    ? (caseDetail.testing?.payoutMethods ?? null)
    : null

  const merchant = caseDetail.merchant
  const merchantId = getMerchantString(merchant, 'id') ?? undefined
  const saveMidCreationDetails = useSaveMidCreationDetails(caseId, merchantId)
  const websiteCmsValue = getMerchantString(merchant, 'websiteCms')
  const businessWebsite = getMerchantString(merchant, 'businessWebsite')
  const bankName = getMerchantString(merchant, 'bankName')
  const accountNumberIban = getMerchantString(merchant, 'accountNumberIban')
  const merchantEmail =
    getMerchantString(merchant, 'businessEmail') ??
    getMerchantString(merchant, 'email') ??
    ''
  const platformLabel = getWebsitePlatformLabel(websiteCmsValue)
  const isShopify = websiteCmsValue === 'shopify'
  const limitsAndMdr = configurationQuery.data?.limitsAndMdr
  const configuredPaymentMethods = configurationQuery.data?.paymentMethods
  const configuredPayoutMethods = configurationQuery.data?.payoutMethods
  const availablePaymentMethods = mergeMethods(
    configuredPaymentMethods ?? DEFAULT_METHODS,
    formSafeMethods(savedPaymentMethods),
  )
  const availablePayoutMethods = mergeMethods(
    configuredPayoutMethods ?? DEFAULT_METHODS,
    formSafeMethods(savedPayoutMethods),
  )
  const cardRate = isShopify
    ? `${limitsAndMdr?.rates.cardShopify ?? SHOPIFY_CARD_RATE}%`
    : `${limitsAndMdr?.rates.cardDefault ?? DEFAULT_CARD_RATE}%`
  const eWalletRate = `${limitsAndMdr?.rates.eWallets ?? E_WALLET_QR_RATE}%`
  const payoutRate = `${limitsAndMdr?.rates.payout ?? PAYOUT_RATE}%`

  const [form, setForm] = useState<MidDetailsForm>({
    portalMid: savedPortalMid ?? Number.NaN,
    portalMuid: savedPortalMuid ?? '',
    email: merchantEmail,
    password: '',
    paymentMethods: savedPaymentMethods ?? DEFAULT_METHODS,
    payoutMethods: savedPayoutMethods ?? DEFAULT_METHODS,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [passwordVisible, setPasswordVisible] = useState(false)

  useEffect(() => {
    setForm((current) => ({
      ...current,
      paymentMethods: savedPaymentMethods ?? current.paymentMethods,
      payoutMethods: savedPayoutMethods ?? current.payoutMethods,
    }))
  }, [savedPaymentMethods, savedPayoutMethods])

  function updateField<TKey extends keyof MidDetailsForm>(
    key: TKey,
    value: MidDetailsForm[TKey],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  function toggleMethod(
    field: 'paymentMethods' | 'payoutMethods',
    method: PaymentMethodSettings[number],
    checked: boolean,
  ) {
    const currentMethods = form[field]
    const nextMethods = checked
      ? mergeMethods(currentMethods, [method])
      : currentMethods.filter((item) => item.id !== method.id)
    updateField(field, nextMethods)
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

      {isCaseOwner ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle>Financial Information</CardTitle>
                <CardDescription>
                  Settlement bank account details submitted by the merchant.
                </CardDescription>
              </div>
              <Badge variant="secondary">
                <Landmark />
                Owner only
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Bank Name</FieldLabel>
                <ReadonlyValue>{bankName ?? 'Not provided'}</ReadonlyValue>
              </Field>
              <Field>
                <FieldLabel>Account Number / IBAN</FieldLabel>
                <ReadonlyValue>
                  {accountNumberIban ?? 'Not provided'}
                </ReadonlyValue>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

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
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Collection methods configured by admin for this merchant.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              <Wallet />
              Collection
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <MethodList
            idPrefix="mid-payment-method"
            availableMethods={availablePaymentMethods}
            selectedMethods={form.paymentMethods}
            disabled={!canEdit || saveMidCreationDetails.isPending}
            empty="No payment methods configured."
            error={errors.paymentMethods}
            onToggle={(method, checked) =>
              toggleMethod('paymentMethods', method, checked)
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Payout Methods</CardTitle>
              <CardDescription>
                Payout methods configured by admin for this merchant.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              <Send />
              Payout
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <MethodList
            idPrefix="mid-payout-method"
            availableMethods={availablePayoutMethods}
            selectedMethods={form.payoutMethods}
            disabled={!canEdit || saveMidCreationDetails.isPending}
            empty="No payout methods configured."
            error={errors.payoutMethods}
            onToggle={(method, checked) =>
              toggleMethod('payoutMethods', method, checked)
            }
          />
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
            <Field data-invalid={Boolean(errors.portalMuid)}>
              <FieldLabel htmlFor="portal-muid">Portal MUID</FieldLabel>
              <Input
                id="portal-muid"
                type="text"
                inputMode="text"
                placeholder="589365dc-e5fd-40ec-a7d6-75cb9a0c3bea"
                value={form.portalMuid}
                disabled={!canEdit || saveMidCreationDetails.isPending}
                aria-invalid={Boolean(errors.portalMuid)}
                onChange={(event) =>
                  updateField('portalMuid', event.target.value)
                }
              />
              <FieldError>{errors.portalMuid}</FieldError>
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
            Only the current case owner can save the Portal MID and MUID.
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

function MethodList({
  idPrefix,
  availableMethods,
  selectedMethods,
  disabled,
  empty,
  error,
  onToggle,
}: {
  idPrefix: string
  availableMethods: PaymentMethodSettings
  selectedMethods: PaymentMethodSettings
  disabled: boolean
  empty: string
  error?: string
  onToggle: (method: PaymentMethodSettings[number], checked: boolean) => void
}) {
  if (availableMethods.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }

  const selectedIds = new Set(selectedMethods.map((method) => method.id))

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldGroup className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {availableMethods.map((method) => {
          const checked = selectedIds.has(method.id)
          const checkboxId = `${idPrefix}-${method.id}`
          return (
            <Field
              key={method.id}
              orientation="horizontal"
              data-disabled={disabled ? true : undefined}
              className={cn(
                'rounded-md border bg-muted/20 px-3 py-2',
                checked && 'border-primary bg-primary/5',
              )}
            >
              <Checkbox
                id={checkboxId}
                checked={checked}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                onCheckedChange={(nextChecked) => {
                  if (typeof nextChecked === 'boolean') {
                    onToggle(method, nextChecked)
                  }
                }}
              />
              <FieldLabel htmlFor={checkboxId} className="font-medium">
                {method.label}
              </FieldLabel>
            </Field>
          )
        })}
      </FieldGroup>
      <FieldError>{error}</FieldError>
    </Field>
  )
}

function formSafeMethods(methods: PaymentMethodSettings | null) {
  return methods ?? DEFAULT_METHODS
}

function mergeMethods(
  currentMethods: PaymentMethodSettings,
  nextMethods: PaymentMethodSettings,
) {
  const merged = [...currentMethods]
  const seen = new Set(merged.map((method) => method.id))
  for (const method of nextMethods) {
    if (!seen.has(method.id)) {
      merged.push(method)
      seen.add(method.id)
    }
  }
  return merged
}
