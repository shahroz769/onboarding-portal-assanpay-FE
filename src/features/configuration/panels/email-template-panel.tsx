import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'

import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { MonitorIcon, SmartphoneIcon } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { emailTemplatePreviewQueryOptions } from '#/hooks/use-configuration-query'
import { cn } from '#/lib/utils'
import type { EmailTemplatePreview } from '#/schemas/configuration.schema'

import { EmailTemplateSkeleton } from '../configuration-route-skeleton'
import { ConfigurationLoadError } from './configuration-panel-shared'

const routeApi = getRouteApi('/_app/configuration/email-templates/$templateKey')

type PreviewView = 'email' | 'plain-text'
type PreviewWidth = 'desktop' | 'mobile'

export function EmailTemplatePanel() {
  const { templateKey } = routeApi.useParams()
  const { data, isPending, error, refetch } = useQuery(
    emailTemplatePreviewQueryOptions(templateKey),
  )

  if (isPending) return <EmailTemplateSkeleton />
  if (error) {
    return (
      <ConfigurationLoadError
        title="Email template"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }

  // Keyed so the view, width and hovered variable reset per template.
  return <EmailTemplateView key={data.key} template={data} />
}

function EmailTemplateView({ template }: { template: EmailTemplatePreview }) {
  const [view, setView] = useState<PreviewView>('email')
  const [width, setWidth] = useState<PreviewWidth>('desktop')
  const [activeVariable, setActiveVariable] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  /** Scrolls the first place a variable appears into view. */
  function revealVariable(name: string) {
    const target =
      view === 'email'
        ? frameRef.current?.contentDocument?.querySelector(
            `[data-var="${CSS.escape(name)}"]`,
          )
        : document.querySelector(`[data-plain-var="${CSS.escape(name)}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-base font-semibold">{template.label}</h2>
            <p className="text-sm text-muted-foreground">
              Sent to the {template.audience.toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {template.plainText !== null ? (
              <Tabs
                value={view}
                onValueChange={(value) => setView(value as PreviewView)}
              >
                <TabsList aria-label="Version">
                  <TabsTrigger value="email">Email</TabsTrigger>
                  <TabsTrigger value="plain-text">Plain text</TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}
            <Tabs
              value={width}
              onValueChange={(value) => setWidth(value as PreviewWidth)}
            >
              <TabsList aria-label="Preview width">
                <TabsTrigger value="desktop" aria-label="Desktop width">
                  <MonitorIcon />
                </TabsTrigger>
                <TabsTrigger value="mobile" aria-label="Mobile width">
                  <SmartphoneIcon />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 border-b bg-muted/20 px-5 py-4 text-sm">
          <dt className="text-muted-foreground">From</dt>
          <dd className="truncate">
            {view === 'email' ? template.from : 'Your Gmail account'}
          </dd>
          <dt className="text-muted-foreground">To</dt>
          <dd>{template.audience}</dd>
          <dt className="text-muted-foreground">Subject</dt>
          <dd className="font-semibold wrap-break-word">
            <TokenText
              text={template.subject}
              activeVariable={activeVariable}
            />
          </dd>
        </dl>
        <div className="bg-muted/40 px-3 py-6 sm:px-8">
          {view === 'email' ? (
            <EmailFrame
              ref={frameRef}
              html={template.html}
              width={width}
              activeVariable={activeVariable}
            />
          ) : (
            <pre
              className={cn(
                'mx-auto rounded-md border bg-background p-5 font-sans text-sm leading-relaxed whitespace-pre-wrap wrap-break-word shadow-xs transition-[max-width] duration-300 ease-out motion-reduce:transition-none',
                width === 'mobile' ? 'max-w-94' : 'max-w-full',
              )}
            >
              <TokenText
                text={template.plainText ?? ''}
                activeVariable={activeVariable}
                markPlainText
              />
            </pre>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-0">
        <RailCard title="When it's sent">
          <p className="text-sm text-pretty">{template.trigger}</p>
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-medium text-muted-foreground">
              Recipients
            </h4>
            <p className="text-sm text-pretty">{template.recipients}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <h4 className="text-xs font-medium text-muted-foreground">
              Delivery
            </h4>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">Resend · automatic</Badge>
              {template.plainText !== null ? (
                <Badge variant="outline">Gmail · manual</Badge>
              ) : null}
            </div>
          </div>
        </RailCard>

        <RailCard
          title="Variables"
          count={template.variables.length}
          description="Hover to find one in the email, click to scroll to it."
        >
          <ul
            className="-mx-2 flex flex-col"
            onMouseLeave={() => setActiveVariable(null)}
          >
            {template.variables.map((variable) => (
              <li key={variable.name}>
                <button
                  type="button"
                  data-active={activeVariable === variable.name || undefined}
                  onMouseEnter={() => setActiveVariable(variable.name)}
                  onFocus={() => setActiveVariable(variable.name)}
                  onBlur={() => setActiveVariable(null)}
                  onClick={() => revealVariable(variable.name)}
                  className="flex w-full flex-col items-start gap-1 rounded-md px-2 py-2 text-left transition-colors outline-none hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring data-active:bg-primary/5"
                >
                  <code className="rounded-sm bg-primary/10 px-1 py-0.5 font-mono text-xs font-semibold wrap-anywhere text-primary">
                    {`{{${variable.name}}}`}
                  </code>
                  <span className="text-xs text-pretty text-muted-foreground">
                    {variable.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </RailCard>

        {template.notes.length > 0 ? (
          <RailCard title="Variations">
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm text-pretty">
              {template.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </RailCard>
        ) : null}
      </aside>
    </div>
  )
}

function RailCard({
  title,
  count,
  description,
  children,
}: {
  title: string
  count?: number
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex flex-col gap-0.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {count !== undefined ? (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {count}
            </span>
          ) : null}
        </h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

const TOKEN_SPLIT = /(\{\{[\w.]+\}\})/g

/**
 * Text with each `{{variable}}` highlighted like the email preview, and the
 * hovered variable emphasised.
 */
function TokenText({
  text,
  activeVariable,
  markPlainText = false,
}: {
  text: string
  activeVariable: string | null
  /** Tag tokens so a click in the variables list can scroll to them. */
  markPlainText?: boolean
}) {
  return text.split(TOKEN_SPLIT).map((part, index) => {
    if (index % 2 === 0) return part
    const name = part.slice(2, -2)
    return (
      <span
        key={index}
        data-plain-var={markPlainText ? name : undefined}
        className={cn(
          'rounded-sm bg-primary/10 px-0.75 font-semibold text-primary transition-[background-color,box-shadow] duration-150',
          activeVariable === name && 'bg-primary/20 ring-2 ring-primary',
        )}
      >
        {part}
      </span>
    )
  })
}

// Links point at `{{variable}}` placeholders, so clicking them would only
// break the frame. The hovered variable gets the same ring as TokenText, in
// the light theme's --primary since emails always render light.
const PREVIEW_STYLE = `<style>
a{pointer-events:none;cursor:default;}
[data-var]{transition:background-color .15s,box-shadow .15s;}
[data-var][data-active]{background-color:rgba(74,109,101,.22)!important;box-shadow:0 0 0 2px rgb(74,109,101);}
</style>`

/**
 * The rendered email in a sandboxed frame (no scripts), grown to the email's
 * full height so the page scrolls instead of the frame.
 */
function EmailFrame({
  ref,
  html,
  width,
  activeVariable,
}: {
  ref: RefObject<HTMLIFrameElement | null>
  html: string
  width: PreviewWidth
  activeVariable: string | null
}) {
  const [height, setHeight] = useState(640)
  // Hidden until the email has loaded and the frame has its height, so the
  // blank frame and the resize never show.
  const [ready, setReady] = useState(false)
  const observerRef = useRef<ResizeObserver | null>(null)
  const activeRef = useRef(activeVariable)

  useEffect(() => () => observerRef.current?.disconnect(), [])

  function markActive(doc: Document, name: string | null) {
    for (const token of doc.querySelectorAll<HTMLElement>('[data-var]')) {
      token.toggleAttribute('data-active', token.dataset.var === name)
    }
  }

  useEffect(() => {
    activeRef.current = activeVariable
    const doc = ref.current?.contentDocument
    if (doc) markActive(doc, activeVariable)
  }, [ref, activeVariable])

  function handleLoad() {
    const doc = ref.current?.contentDocument
    const body = doc?.body
    if (!doc || !body) return
    markActive(doc, activeRef.current)
    observerRef.current?.disconnect()
    // The body, not the document: the document is never shorter than the
    // frame, so it could grow the frame but never shrink it back.
    const measure = () => {
      const style = getComputedStyle(body)
      setHeight(
        Math.ceil(
          body.getBoundingClientRect().height +
            parseFloat(style.marginTop) +
            parseFloat(style.marginBottom),
        ),
      )
    }
    measure()
    setReady(true)
    observerRef.current = new ResizeObserver(measure)
    observerRef.current.observe(body)
  }

  const srcDoc = html.includes('</head>')
    ? html.replace('</head>', `${PREVIEW_STYLE}</head>`)
    : PREVIEW_STYLE + html

  return (
    <div className="relative">
      {/* Same block as EmailTemplateSkeleton, so loading carries on from it. */}
      {!ready ? (
        <Skeleton className="absolute inset-0 h-160 w-full rounded-md" />
      ) : null}
      <iframe
        ref={ref}
        title="Email preview"
        srcDoc={srcDoc}
        sandbox="allow-same-origin"
        onLoad={handleLoad}
        style={{ height }}
        className={cn(
          'mx-auto block w-full rounded-md bg-white shadow-xs transition-[max-width,opacity] duration-300 ease-out motion-reduce:transition-none',
          width === 'mobile' ? 'max-w-94' : 'max-w-full',
          ready ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
