import { lazy, Suspense } from 'react'
import {
  ClientOnly,
  HeadContent,
  Scripts,
  Link,
  createRootRouteWithContext,
} from '@tanstack/react-router'

import { FileQuestion } from 'lucide-react'

import { ErrorPage } from '#/components/error-state'
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
        href: '/fonts/Geist-Latin.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        // Headings and the login wordmark.
        rel: 'preload',
        href: '/fonts/Outfit-Latin.woff2',
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
    <ErrorPage
      tone="muted"
      icon={<FileQuestion />}
      title="Page not found"
      description="This page does not exist or has moved. Check the address, or go to the dashboard."
      actions={
        <ButtonLink render={<Link to="/" />}>Go to dashboard</ButtonLink>
      }
    />
  )
}
