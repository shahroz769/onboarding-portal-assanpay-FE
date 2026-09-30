import { Fragment, useEffect, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  Copy,
  History,
  Info,
  ListChecks,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import * as z from 'zod'

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { ScrollArea } from '#/components/ui/scroll-area'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
import { EmptyState } from '#/components/empty-state'
import { useAuth } from '#/features/auth/auth-client'
import { fetchPendingPortalMidValues } from '#/apis/dashboard'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { cn } from '#/lib/utils'
import { useMorph } from '#/hooks/use-morph'
import {
  appliedPortalMidsQueryOptions,
  pendingPortalMidsInfiniteQueryOptions,
  useApplyPortalMidLimits,
} from '#/hooks/use-dashboard-query'
import type {
  ApplyPortalMidLimitsInput,
  DashboardPendingPortalMidLimit,
  DashboardResponse,
  PendingPortalMidCounts,
  PendingPortalMidGroup,
} from '#/schemas/dashboard.schema'

const pastedMidsSchema = z
  .array(z.number().int().positive())
  .min(1, 'Paste at least one portal MID.')

const MID_GROUP_LABELS: Record<PendingPortalMidGroup, string> = {
  internal: 'Internal',
  custom_wordpress: 'Custom/WordPress',
  shopify: 'Shopify',
}

const pendingMidColumns: DataTableColumnDef<DashboardPendingPortalMidLimit>[] =
  [
    {
      id: 'merchant',
      header: 'Merchant',
      cell: (item) => (
        <div className="flex flex-col leading-tight whitespace-normal">
          <span className="font-medium">{item.merchantName}</span>
          <span className="text-xs text-muted-foreground">
            {item.subMerchantName ?? 'Sub-merchant not selected'}
          </span>
        </div>
      ),
    },
    {
      id: 'midKind',
      header: 'MID type',
      width: 140,
      cell: (item) => (
        <Badge variant={item.group === 'internal' ? 'secondary' : 'outline'}>
          {MID_GROUP_LABELS[item.group]}
        </Badge>
      ),
    },
    {
      id: 'portalMid',
      header: <span className="block text-right">Portal MID</span>,
      width: 130,
      cell: (item) => <CopyMidButton mid={item.portalMid} />,
    },
  ]

const EMPTY_PENDING: DashboardPendingPortalMidLimit[] = []
const EMPTY_COUNTS: PendingPortalMidCounts = {
  total: 0,
  internal: 0,
  customWordpress: 0,
  shopify: 0,
}

/** Without `data`, renders the loading state with the exact loaded layout. */
export function DashboardPortalMids({ data }: { data?: DashboardResponse }) {
  const { user } = useAuth()
  const applyLimits = useApplyPortalMidLimits()
  const pendingQuery = useInfiniteQuery(pendingPortalMidsInfiniteQueryOptions())
  const isLoading = !data
  const pending = pendingQuery.data
    ? pendingQuery.data.pages.flatMap((page) => page.data)
    : EMPTY_PENDING
  // Only the first page carries the totals.
  const counts = pendingQuery.data?.pages[0]?.counts ?? EMPTY_COUNTS

  const canApply =
    user?.roleType === 'super_admin' || user?.roleType === 'admin'
  const [open, setOpen] = useState(false)
  const [appliedOpen, setAppliedOpen] = useState(false)
  const [isOpeningApplied, setIsOpeningApplied] = useState(false)
  // Every applied MID can be a long list, so it loads only for the dialog:
  // the Applied button fetches it first and opens the dialog once it's in.
  const queryClient = useQueryClient()
  const appliedQuery = useQuery({
    ...appliedPortalMidsQueryOptions(),
    enabled: appliedOpen,
  })
  const applied = appliedQuery.data
  const appliedCsv = applied?.csv ?? ''
  // Both dialogs grow out of the buttons that open them.
  const applyMorph = useMorph()
  const appliedMorph = useMorph()
  const [value, setValue] = useState('')
  const [category, setCategory] =
    useState<ApplyPortalMidLimitsInput['category']>('custom_wordpress')
  const [error, setError] = useState<string | null>(null)
  const parsedPortalMids = parsePortalMids(value)

  async function handleOpenApplied(trigger: HTMLElement) {
    if (isOpeningApplied) return
    setIsOpeningApplied(true)
    try {
      // Served from cache while fresh; otherwise the button shows a spinner.
      await queryClient.fetchQuery(appliedPortalMidsQueryOptions())
      appliedMorph.run(() => {
        setIsOpeningApplied(false)
        setAppliedOpen(true)
      }, trigger)
    } catch (fetchError) {
      setIsOpeningApplied(false)
      toast.error(
        getApiErrorMessage(fetchError, 'Could not load applied portal MIDs'),
      )
    }
  }

  async function handleCopyApplied() {
    if (!appliedCsv) return
    await navigator.clipboard.writeText(appliedCsv)
    toast.success('Applied portal MIDs copied')
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValue('')
      setCategory('custom_wordpress')
      setError(null)
    }
  }

  async function handleSave() {
    if (parsedPortalMids.error) {
      setError(parsedPortalMids.error)
      return
    }

    const result = pastedMidsSchema.safeParse(parsedPortalMids.portalMids)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Enter valid portal MIDs.')
      return
    }

    setError(null)
    await applyLimits.mutateAsync({
      portalMids: result.data,
      category,
    })
    setOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        {/* min-h-8 = action button height; the agreements card uses the same so both tables start level. */}
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle>Portal MIDs awaiting limits</CardTitle>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="What is a portal MID?"
                    className="text-muted-foreground"
                  />
                }
              >
                <Info />
              </TooltipTrigger>
              <TooltipContent className="max-w-72">
                A MID (merchant ID) is the merchant's account ID on the payment
                portal. MIDs from successful MID Creation cases wait here until
                their limits are applied.
              </TooltipContent>
            </Tooltip>
            {isLoading || pendingQuery.isPending ? (
              // h-5.5 = Badge height (py-0.5 + text-xs line + border)
              <Skeleton className="h-5.5 w-9 rounded-full" />
            ) : (
              <Badge variant={counts.total > 0 ? 'outline' : 'secondary'}>
                {counts.total > 0 ? <ListChecks /> : <CheckCircle2 />}
                {counts.total}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CopyMidsMenu counts={counts} disabled={isLoading} />
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => void handleOpenApplied(event.currentTarget)}
              disabled={isLoading}
              aria-busy={isOpeningApplied}
            >
              {isOpeningApplied ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <History data-icon="inline-start" />
              )}
              Applied
            </Button>
            <Button
              size="sm"
              onClick={(event) =>
                applyMorph.run(
                  () => handleOpenChange(true),
                  event.currentTarget,
                )
              }
              disabled={isLoading || !canApply}
            >
              <ShieldCheck data-icon="inline-start" />
              Apply limits
            </Button>
          </div>
        </div>
        <CardDescription>
          MIDs from successful MID Creation cases waiting for limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Absolute table: rows never size the grid row, so it scrolls at a
            fixed base height and only grows to match the neighbouring card. */}
        <div className="relative min-h-80 flex-1">
          <DataTable
            columns={pendingMidColumns}
            data={pending}
            getRowId={(item) =>
              `${item.caseId}-${item.midKind}-${item.portalMid}`
            }
            isLoading={isLoading || pendingQuery.isPending}
            error={pendingQuery.error}
            onRetry={() => void pendingQuery.refetch()}
            onScrollEnd={() => void pendingQuery.fetchNextPage()}
            hasMore={pendingQuery.hasNextPage}
            isFetchingMore={pendingQuery.isFetchingNextPage}
            totalCount={counts.total}
            className="absolute inset-0"
            emptyContent={
              <EmptyState
                icon={CheckCircle2}
                tone="success"
                title="All eligible portal MIDs are complete."
                description="No successful MID Creation cases are waiting for testing or limit application. You can still pre-apply limits for MIDs before onboarding."
              />
            }
          />
        </div>
        {!canApply ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Only Super Admins and Admins can apply or pre-apply limits.
          </p>
        ) : null}
      </CardContent>

      <Dialog open={appliedOpen} onOpenChange={setAppliedOpen}>
        <DialogContent {...appliedMorph.popupProps}>
          <DialogHeader>
            <DialogTitle>Applied portal MIDs</DialogTitle>
            <DialogDescription>
              Portal MIDs whose limits have already been saved.
            </DialogDescription>
          </DialogHeader>

          {applied && appliedCsv ? (
            <ScrollArea viewportClassName="max-h-[min(60vh,calc(100dvh-16rem))]">
              <div className="flex flex-col gap-4 pr-3">
                <AppliedMidSection
                  title="Custom/WordPress"
                  mids={applied.customWordpress}
                />

                <AppliedMidSection title="Shopify" mids={applied.shopify} />

                <AppliedMidSection title="Internal" mids={applied.internal} />
              </div>
            </ScrollArea>
          ) : (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>No applied portal MIDs</AlertTitle>
              <AlertDescription>
                No portal MIDs have been saved as applied yet.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAppliedOpen(false)}>
              Close
            </Button>
            <Button onClick={handleCopyApplied} disabled={!appliedCsv}>
              <ClipboardCopy data-icon="inline-start" />
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent {...applyMorph.popupProps}>
          <DialogHeader>
            <DialogTitle>Apply limits</DialogTitle>
            <DialogDescription>
              Select the MID category, then paste the MIDs whose limits have
              been applied. You can also add MIDs in advance before onboarding.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="portal-mid-category">Category</FieldLabel>
              <Select
                items={[
                  { value: 'custom_wordpress', label: 'Custom/WordPress' },
                  { value: 'shopify', label: 'Shopify' },
                  { value: 'internal', label: 'Internal' },
                ]}
                value={category}
                disabled={applyLimits.isPending}
                onValueChange={(nextCategory) =>
                  setCategory(
                    nextCategory as ApplyPortalMidLimitsInput['category'],
                  )
                }
              >
                <SelectTrigger id="portal-mid-category" className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom_wordpress">
                    Custom/WordPress
                  </SelectItem>
                  <SelectItem value="shopify">Shopify</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Saved MIDs appear under this section in Applied Previously.
              </FieldDescription>
            </Field>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="portal-mids">Portal MIDs</FieldLabel>
              <Textarea
                id="portal-mids"
                value={value}
                aria-invalid={Boolean(error)}
                className="max-h-64 min-h-32 font-mono"
                placeholder="1,2,5,8,9001,9002"
                disabled={applyLimits.isPending}
                onChange={(event) => {
                  setValue(event.target.value)
                  if (error) setError(null)
                }}
              />

              <FieldDescription>
                Enter comma-separated MIDs. Saved dashboard lists are shown
                without spaces.
              </FieldDescription>
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={applyLimits.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={applyLimits.isPending}>
              {applyLimits.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ShieldCheck data-icon="inline-start" />
              )}
              {applyLimits.isPending ? 'Saving' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    toast.error('Could not copy to the clipboard')
    return false
  }
}

/** Shows a check for a moment after a successful copy. */
function useCopiedFlag() {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  function flag() {
    setCopied(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }

  return [copied, flag] as const
}

/**
 * Stacks every icon in one cell and cross-fades to the `active` one (scale,
 * opacity and blur), so a state change never pops. All stay mounted, which
 * lets the outgoing icon animate out too.
 */
function IconSwap<Key extends string>({
  active,
  icons,
}: {
  active: Key
  icons: Record<Key, React.ReactNode>
}) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center *:col-start-1 *:row-start-1"
    >
      {(Object.keys(icons) as Key[]).map((key) => (
        <span
          key={key}
          className={cn(
            'flex transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
            key === active
              ? 'scale-100 opacity-100 blur-[0px]'
              : 'scale-[0.25] opacity-0 blur-xs',
          )}
        >
          {icons[key]}
        </span>
      ))}
    </span>
  )
}

function CopyMidButton({ mid }: { mid: number }) {
  const [copied, flagCopied] = useCopiedFlag()

  return (
    <button
      type="button"
      aria-label={`Copy MID ${mid}`}
      className="group/mid ml-auto flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono font-medium tabular-nums transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      onClick={async () => {
        if (await copyText(String(mid))) flagCopied()
      }}
    >
      <IconSwap
        active={copied ? 'check' : 'copy'}
        icons={{
          // Revealed on hover/focus only; the swap handles the copied check.
          copy: (
            <Copy className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/mid:opacity-100 group-focus-visible/mid:opacity-100" />
          ),
          check: <Check className="size-3.5 text-primary" />,
        }}
      />
      {mid}
    </button>
  )
}

// Internal copies internal portal MIDs; Custom/WordPress and Shopify copy the
// portal MIDs of merchants on that website CMS.
const COPY_OPTIONS = [
  { key: 'total', label: 'All pending', group: undefined },
  { key: 'internal', label: 'Internal', group: 'internal' },
  {
    key: 'customWordpress',
    label: 'Custom/WordPress',
    group: 'custom_wordpress',
  },
  { key: 'shopify', label: 'Shopify', group: 'shopify' },
] as const satisfies readonly {
  key: keyof PendingPortalMidCounts
  label: string
  group?: PendingPortalMidGroup
}[]

/** Copies every pending MID of a group from the DB, not just the loaded rows. */
function CopyMidsMenu({
  counts,
  disabled,
}: {
  counts: PendingPortalMidCounts
  disabled: boolean
}) {
  const [isCopying, setIsCopying] = useState(false)
  const [copied, flagCopied] = useCopiedFlag()

  async function handleCopy(option: (typeof COPY_OPTIONS)[number]) {
    setIsCopying(true)
    try {
      const mids = await fetchPendingPortalMidValues(option.group)
      // "Custom/WordPress" keeps its casing; the other labels read lowercase.
      const groupLabel = option.group
        ? option.group === 'custom_wordpress'
          ? option.label
          : option.label.toLowerCase()
        : ''
      if (mids.length === 0) {
        toast.info(`No ${groupLabel || 'pending'} MIDs to copy`)
        return
      }
      if (await copyText(mids.join(','))) {
        flagCopied()
        toast.success(
          `${mids.length} ${groupLabel ? `${groupLabel} ` : ''}MID${mids.length === 1 ? '' : 's'} copied`,
        )
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not load MIDs to copy'))
    } finally {
      setIsCopying(false)
    }
  }

  const countFor = (key: (typeof COPY_OPTIONS)[number]['key']) => counts[key]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || isCopying || counts.total === 0}
          />
        }
      >
        <IconSwap
          active={isCopying ? 'loading' : copied ? 'check' : 'copy'}
          icons={{
            copy: <Copy />,
            check: <Check className="text-primary" />,
            // Only spins while shown; the button's disabled state and the
            // toast carry the status, so the hidden spinner isn't announced.
            loading: <Spinner className={cn(!isCopying && 'animate-none')} />,
          }}
        />
        Copy MIDs
        <ChevronDown data-icon="inline-end" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Copy pending MIDs
          </DropdownMenuLabel>
          {COPY_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.key}
              disabled={countFor(option.key) === 0}
              onClick={() => void handleCopy(option)}
            >
              <Copy />
              {option.label}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {countFor(option.key)}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AppliedMidSection({ title, mids }: { title: string; mids: number[] }) {
  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <Badge variant="outline">{mids.length}</Badge>
      </div>
      {mids.length > 0 ? (
        // <wbr> lets the list wrap after any comma without adding characters
        // to copied text; wrap-anywhere covers a single oversized MID.
        <p className="font-mono text-sm wrap-anywhere">
          {mids.map((mid, index) => (
            <Fragment key={`${mid}-${index}`}>
              {index > 0 ? (
                <>
                  ,<wbr />
                </>
              ) : null}
              {mid}
            </Fragment>
          ))}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No applied MIDs.</p>
      )}
    </section>
  )
}

const portalMidRangePattern = /(\d+)\s*-\s*(\d+)/g

function parsePortalMids(value: string): {
  portalMids: number[]
  error: string | null
} {
  const mids: number[] = []
  let remaining = value.replace(/\bup\s*to\b/gi, '-')
  remaining = remaining.replace(/\bupto\b/gi, '-')
  remaining = remaining.replace(/\bto\b/gi, '-')

  const hasDescendingRange = Array.from(
    remaining.matchAll(portalMidRangePattern),
  ).some(([, startValue, endValue]) => Number(startValue) > Number(endValue))

  if (hasDescendingRange) {
    return {
      portalMids: [],
      error: 'MID ranges must go from the smaller number to the larger number.',
    }
  }

  remaining = remaining.replace(
    portalMidRangePattern,
    (match, startValue: string, endValue: string) => {
      const start = Number(startValue)
      const end = Number(endValue)

      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        return match
      }

      for (let mid = start; mid <= end; mid += 1) {
        mids.push(mid)
      }

      return ' '
    },
  )

  const standaloneMids = remaining
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number)

  mids.push(...standaloneMids)

  if (mids.some((mid) => !Number.isSafeInteger(mid) || mid <= 0)) {
    return {
      portalMids: [],
      error: 'Enter only positive whole-number portal MIDs.',
    }
  }

  if (/\d+\s*-\s*\d+/.test(remaining)) {
    return {
      portalMids: [],
      error: 'MID ranges must go from the smaller number to the larger number.',
    }
  }

  return {
    portalMids: Array.from(new Set(mids)).sort((a, b) => a - b),
    error: null,
  }
}
