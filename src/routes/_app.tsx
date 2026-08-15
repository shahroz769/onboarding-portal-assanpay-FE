import {
  Outlet,
  Link,
  createFileRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { AppSidebar } from '#/components/app-sidebar'
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

export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    await requireAuthSession({
      auth: context.auth,
      queryClient: context.queryClient,
      redirectTo: location.href,
    })
  },
  component: AppLayout,
})

function AppLayout() {
  const router = useRouter()
  const currentMatches = useRouterState({
    select: (state) => state.matches,
  })
  const pendingMatches = useStore(router.stores.pendingMatches)
  const isLoading = useStore(router.stores.isLoading)
  const matches =
    isLoading && pendingMatches.length > 0 ? pendingMatches : currentMatches
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
      }
    | undefined
  const title = staticData?.title ?? ''
  const subtitle = staticData?.subtitle
  const hidePageShell =
    isCaseDetailRoute || (staticData?.hidePageShell ?? false)
  const caseDetailMatch = matches.find(
    (match) => match.routeId === '/_app/cases/$caseId',
  )
  const caseDetail = caseDetailMatch?.loaderData as
    | {
        case?: { caseNumber?: string }
        queue?: { name?: string }
      }
    | undefined

  return (
    <SidebarProvider>
      <NotificationsProvider />
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden bg-muted/30">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to="/">AssanPay</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              {isCaseDetailRoute ? (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/cases/all-cases">All Cases</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <span className="text-sm text-muted-foreground">
                      {caseDetail?.queue?.name ?? 'Queue'}
                    </span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {caseDetail?.case?.caseNumber ?? 'Case'}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6">
          {hidePageShell ? (
            <Outlet />
          ) : (
            <div className="flex min-h-full shrink-0 flex-col">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
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
                  id="page-header-actions"
                  className="flex shrink-0 items-center gap-2"
                />
              </div>
              <Outlet />
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
