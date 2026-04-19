import {
  Outlet,
  Link,
  createFileRoute,
  useMatches,
} from '@tanstack/react-router'
import { AppSidebar } from '#/components/app-sidebar'
import { ThemeToggle } from '#/components/theme-toggle'
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

export const Route = createFileRoute('/_app')({
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
  const matches = useMatches()
  const isCaseDetailRoute = matches.some(
    (match) => match.routeId === '/_app/cases/$caseId',
  )
  const activeMatch = [...matches]
    .reverse()
    .find((match) => (match.staticData as { title?: string } | undefined)?.title)
  const staticData = activeMatch?.staticData as
    | {
        title?: string
        subtitle?: string
        hidePageShell?: boolean
      }
    | undefined
  const title = staticData?.title ?? 'Dashboard'
  const subtitle = staticData?.subtitle
  const hidePageShell = isCaseDetailRoute || (staticData?.hidePageShell ?? false)
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
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden bg-muted/30">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
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
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6">
          {hidePageShell ? (
            <Outlet />
          ) : (
            <div className="flex min-h-full flex-col rounded-xl border bg-background p-6 shadow-sm">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                  {subtitle && (
                    <p className="text-muted-foreground">{subtitle}</p>
                  )}
                </div>
                <div id="page-header-actions" />
              </div>
              <Outlet />
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
