import type { ReactNode } from 'react'

import { useInAppShell } from '#/hooks/use-in-app-shell'
import { cn } from '#/lib/utils'

type ErrorStateTone = 'destructive' | 'warning' | 'muted'

const toneClasses: Record<ErrorStateTone, string> = {
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  muted: 'bg-muted text-muted-foreground',
}

/**
 * A page-level error, not-found or expired state: icon, title, what happened
 * and what to do next. `surface` draws it as a card, for pages outside the
 * app shell.
 */
export function ErrorState({
  tone = 'destructive',
  icon,
  title,
  description,
  actions,
  error,
  surface = false,
  titleAs,
  className,
}: {
  tone?: ErrorStateTone
  icon: ReactNode
  title: string
  description: ReactNode
  actions?: ReactNode
  /** Shown as collapsible details in development only. */
  error?: unknown
  surface?: boolean
  /** Defaults to h2 inside the app shell (which owns the h1), h1 elsewhere. */
  titleAs?: 'h1' | 'h2'
  className?: string
}) {
  const inAppShell = useInAppShell()
  const Title = titleAs ?? (inAppShell ? 'h2' : 'h1')

  return (
    <div
      role="alert"
      className={cn(
        'flex w-full max-w-md flex-col items-center text-center',
        surface && 'rounded-xl border bg-background p-8 shadow-sm',
        className,
      )}
    >
      <div
        className={cn(
          'flex size-12 items-center justify-center rounded-full [&_svg]:size-6',
          toneClasses[tone],
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
      <Title className="mt-4 text-lg font-semibold tracking-tight text-balance">
        {title}
      </Title>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        {description}
      </p>
      {import.meta.env.DEV && error instanceof Error ? (
        <details className="mt-4 w-full rounded-lg border bg-muted/50 text-left text-xs">
          <summary className="cursor-pointer px-3 py-2 font-medium text-muted-foreground">
            Error details (development only)
          </summary>
          <pre className="max-h-60 overflow-auto border-t px-3 py-2 font-mono whitespace-pre-wrap">
            {error.stack ?? error.message}
          </pre>
        </details>
      ) : null}
      {actions ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Centers an ErrorState for a whole route: in the app shell's content area,
 * or as its own page (with <main> and a card) outside it.
 */
export function ErrorPage(props: Parameters<typeof ErrorState>[0]) {
  if (useInAppShell()) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
        <ErrorState {...props} />
      </div>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <ErrorState surface {...props} />
    </main>
  )
}
