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
  const matches = useMatches()
  const activeMatch = [...matches]
    .reverse()
    .find((match) => (match.staticData as { title?: string } | undefined)?.title)
  const title = (activeMatch?.staticData as { title?: string } | undefined)?.title ?? 'Dashboard'

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh bg-muted/30">
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
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 flex-col p-4 md:p-6">
          <div className="flex flex-1 flex-col rounded-xl border bg-background p-6 shadow-sm">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <div className="mt-6 flex-1">
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
