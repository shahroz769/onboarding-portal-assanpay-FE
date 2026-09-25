import { lazy, Suspense } from 'react'
import {
  ClientOnly,
  HeadContent,
  Scripts,
  Link,
  createRootRouteWithContext,
} from '@tanstack/react-router'

import { ThemeProvider } from '#/components/theme-provider'
import { ButtonLink } from '#/components/ui/button'
import { Toaster } from '#/components/ui/sonner'
import { useIsMobile } from '#/hooks/use-mobile'
import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import type { AuthClient } from '#/features/auth/auth-client'

interface MyRouterContext {
  queryClient: QueryClient
  auth: AuthClient
}

const AppTanStackDevtools = import.meta.env.DEV
  ? lazy(() => import('../integrations/tanstack-devtools'))
  : null

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'AssanPay Onboarding Portal',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        // Fetch the self-hosted font alongside the CSS instead of after it
        // is parsed. crossOrigin is required for font preloads to be reused.
        rel: 'preload',
        href: '/fonts/Geist-Variable.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  notFoundComponent: NotFoundPage,
  shellComponent: RootDocument,
})

// Bottom-anchored toasts cover form submit rows and sticky nav on small
// screens, so mobile toasts drop in from the top instead.
function AppToaster() {
  const isMobile = useIsMobile()

  return (
    <Toaster richColors position={isMobile ? 'top-center' : 'bottom-right'} />
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        suppressHydrationWarning
        className="font-sans antialiased wrap-anywhere selection:bg-primary/25"
      >
        <ThemeProvider>
          {children}
          <AppToaster />
          {AppTanStackDevtools ? (
            <ClientOnly>
              <Suspense fallback={null}>
                <AppTanStackDevtools />
              </Suspense>
            </ClientOnly>
          ) : null}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

function NotFoundPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-background p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">404</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have
            moved.
          </p>
          <ButtonLink className="mt-6" render={<Link to="/" />}>
            Go to Dashboard
          </ButtonLink>
        </div>
      </div>
    </main>
  )
}
