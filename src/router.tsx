import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

import { DefaultRouteError } from '#/components/default-route-error'
import { setApiClientRouter } from '#/lib/api-client'
import {
  routeTransitionTypes,
  trackRouteTransitions,
} from '#/lib/route-transitions'
import { getContext } from './integrations/tanstack-query/root-provider'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultRouteError,
    // Morph UI page, stack and tab motion on route changes. Types
    // only apply where the browser supports them; elsewhere there's no
    // animation (see routeTransitionTypes and styles.css).
    defaultViewTransition: { types: routeTransitionTypes },
    Wrap: ({ children }) => (
      <QueryClientProvider client={context.queryClient}>
        {children}
      </QueryClientProvider>
    ),
  })

  setApiClientRouter(router)
  if (typeof document !== 'undefined') trackRouteTransitions(router)

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
