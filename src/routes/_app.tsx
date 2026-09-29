import { useState } from 'react'
import {
  Outlet,
  Link,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { TruncatedTooltip } from '#/components/truncated-tooltip'
import { AppShellPending } from '#/components/app-shell-pending'
import { AppSidebar } from '#/components/app-sidebar'
import { NavUser } from '#/components/nav-user'
import { ThemeToggle } from '#/components/theme-toggle'
import {
  NotificationBell,
  NotificationsProvider,
} from '#/features/notifications'
import { requireAuthSession } from '#/features/auth/route-guards'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { Separator } from '#/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { InAppShellContext } from '#/hooks/use-in-app-shell'
import { PageHeaderActionsContext } from '#/hooks/use-page-header-actions'
import { caseDetailQueryOptions } from '#/hooks/use-case-detail-query'
import { merchantHeaderQueryOptions } from '#/hooks/use-merchants-query'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: async ({ location, context, preload }) => {
    await requireAuthSession({
      auth: context.auth,
      queryClient: context.queryClient,
      redirectTo: location.href,
      preload,
    })
  },
  // Server-rendered in place of this ssr:false route (see AppShellPending).
  pendingComponent: AppShellPending,
  component: AppLayout,
})

function AppLayout() {
  const [headerActionsEl, setHeaderActionsEl] = useState<HTMLDivElement | null>(
    null,
  )
  const matches = useRouterState({
    select: (state) => state.matches,
  })
  // A route's skeleton is on screen: styles.css animates its arrival (see
  // trackRouteTransitions in lib/route-transitions.ts).
  const showsPendingFallback = matches.some(
    (match) => match.status === 'pending',
  )
  const isCaseDetailRoute = matches.some(
    (match) => match.routeId === '/_app/cases/$caseId',
  )
  const activeMatch = [...matches]
    .reverse()
    .find(
      (match) => (match.staticData as { title?: string } | undefined)?.title,
    )
  const staticData = activeMatch?.staticData as
    | {
        title?: string
        subtitle?: string
        hidePageShell?: boolean
        fitViewport?: boolean
      }
    | undefined
  const title = staticData?.title ?? ''
  const subtitle = staticData?.subtitle
  const hidePageShell =
    isCaseDetailRoute || (staticData?.hidePageShell ?? false)
  const fitViewport = staticData?.fitViewport ?? false
  const caseDetailMatch = matches.find(
    (match) => match.routeId === '/_app/cases/$caseId',
  )
  const merchantDetailMatch = matches.find(
    (match) => match.routeId === '/_app/merchants/$merchantId',
  )
  // Breadcrumb labels come from the detail pages' own queries. `enabled:
  // false` only reads the shared cache: the layout never sends a request.
  const caseId = (caseDetailMatch?.params as { caseId?: string } | undefined)
    ?.caseId
  const merchantId = (
    merchantDetailMatch?.params as { merchantId?: string } | undefined
  )?.merchantId
  const { data: caseDetail } = useQuery({
    ...caseDetailQueryOptions(caseId ?? ''),
    enabled: false,
  })
  const { data: merchantHeader } = useQuery({
    ...merchantHeaderQueryOptions(merchantId ?? ''),
    enabled: false,
  })

  return (
    <InAppShellContext.Provider value={true}>
      <SidebarProvider>
        <a
          href="#main-content"
          onClick={(event) => {
            // Moves focus without a hash change the router would pick up.
            event.preventDefault()
            document.getElementById('main-content')?.focus()
          }}
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
        >
          Skip to content
        </a>
        <NotificationsProvider />
        <AppSidebar />
        <SidebarInset className="h-svh overflow-hidden bg-muted/15">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-sidebar px-4">
            <Tooltip>
              <TooltipTrigger
                render={<SidebarTrigger className="-ml-1 size-9 md:size-7" />}
              />
              <TooltipContent side="bottom">
                Toggle sidebar (Ctrl+B)
              </TooltipContent>
            </Tooltip>
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb className="min-w-0">
              <BreadcrumbList className="flex-nowrap">
                {isCaseDetailRoute ? (
                  <>
                    <BreadcrumbItem className="hidden shrink-0 sm:inline-flex">
                      <BreadcrumbLink render={<Link to="/cases/all-cases" />}>
                        All Cases
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block" />
                    <BreadcrumbItem className="min-w-0">
                      <TruncatedTooltip
                        render={
                          <BreadcrumbLink
                            className="block max-w-48 truncate"
                            render={
                              <Link
                                to="/cases/all-cases"
                                search={{ queueId: caseDetail?.queue?.id }}
                              />
                            }
                          />
                        }
                        content={caseDetail?.queue?.name ?? 'Queue'}
                      >
                        {caseDetail?.queue?.name ?? 'Queue'}
                      </TruncatedTooltip>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="shrink-0">
                      <BreadcrumbPage className="whitespace-nowrap">
                        {caseDetail?.case?.caseNumber ?? 'Case'}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : merchantDetailMatch ? (
                  <>
                    <BreadcrumbItem className="shrink-0">
                      <BreadcrumbLink render={<Link to="/merchants" />}>
                        Merchants
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="min-w-0">
                      <TruncatedTooltip
                        render={
                          <BreadcrumbPage className="block max-w-64 truncate" />
                        }
                        content={merchantHeader?.businessName ?? 'Merchant'}
                      >
                        {merchantHeader?.businessName ?? 'Merchant'}
                      </TruncatedTooltip>
                    </BreadcrumbItem>
                  </>
                ) : (
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="block truncate">
                      {title}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1">
              <NotificationBell />
              <ThemeToggle />
              <NavUser />
            </div>
          </header>

          {/* data-vt="page": the content column that page route transitions
            animate. data-vt-section and data-vt-outlet mark the
            sections that rise in one by one on a page change (styles.css,
            lib/route-transitions.ts). display: contents keeps the outlet
            wrappers out of the layout. */}
          <main
            id="main-content"
            tabIndex={-1}
            data-vt="page"
            data-route-pending={showsPendingFallback || undefined}
            className={cn(
              'flex min-h-0 flex-1 flex-col p-4 outline-none md:p-6',
              fitViewport ? 'overflow-hidden' : 'overflow-y-auto',
            )}
          >
            {hidePageShell ? (
              <>
                {/* The case page has no visible title of its own; the merchant
                  page renders its own <h1>. */}
                {isCaseDetailRoute ? (
                  <h1 className="sr-only">
                    {caseDetail?.case?.caseNumber
                      ? `Case ${caseDetail.case.caseNumber}`
                      : title}
                  </h1>
                ) : null}
                <div data-vt-outlet className="contents">
                  <Outlet />
                </div>
              </>
            ) : (
              <PageHeaderActionsContext.Provider value={headerActionsEl}>
                <div
                  className={cn(
                    'flex min-h-0 flex-col',
                    fitViewport ? 'flex-1' : 'min-h-full shrink-0',
                  )}
                >
                  <div
                    data-vt-section
                    className="mb-6 flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-3"
                  >
                    <div className="min-w-0">
                      <h1 className="text-2xl font-semibold tracking-tight">
                        {title}
                      </h1>
                      {subtitle && (
                        <p className="mt-1 text-sm text-pretty text-muted-foreground">
                          {subtitle}
                        </p>
                      )}
                    </div>
                    <div
                      ref={setHeaderActionsEl}
                      id="page-header-actions"
                      className="flex shrink-0 items-center gap-2"
                    />
                  </div>
                  <div data-vt-outlet className="contents">
                    <Outlet />
                  </div>
                </div>
              </PageHeaderActionsContext.Provider>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </InAppShellContext.Provider>
  )
}
