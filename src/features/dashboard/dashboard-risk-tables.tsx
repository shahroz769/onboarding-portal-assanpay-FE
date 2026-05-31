import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  caseStatusBadgeClasses,
  caseStatusLabel,
  merchantStatusBadgeClasses,
  merchantStatusLabel,
} from '#/features/merchants/merchant-detail-helpers'
import type {
  DashboardRecentClosedCase,
  DashboardRecentMerchant,
  DashboardResponse,
  DashboardRiskCase,
} from '#/schemas/dashboard.schema'
import { formatRelative } from './dashboard-utils'

export function DashboardRiskTables({ data }: { data: DashboardResponse }) {
  const { risk } = data

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Attention required</CardTitle>
          <CardDescription>Cases that need follow-up</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="breached">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="breached">
                SLA ({risk.slaBreachedCases.length})
              </TabsTrigger>
              <TabsTrigger value="awaiting">
                Awaiting ({risk.awaitingClientCases.length})
              </TabsTrigger>
              <TabsTrigger value="oldest">Oldest</TabsTrigger>
              <TabsTrigger value="priority">
                Priority ({risk.highPriorityOpenCases.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="breached">
              <RiskCaseTable
                cases={risk.slaBreachedCases}
                emptyLabel="No SLA breaches"
              />
            </TabsContent>
            <TabsContent value="awaiting">
              <RiskCaseTable
                cases={risk.awaitingClientCases}
                emptyLabel="Nothing awaiting client"
              />
            </TabsContent>
            <TabsContent value="oldest">
              <RiskCaseTable
                cases={risk.oldestOpenCases}
                emptyLabel="No open cases"
              />
            </TabsContent>
            <TabsContent value="priority">
              <RiskCaseTable
                cases={risk.highPriorityOpenCases}
                emptyLabel="No high-priority cases"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <RecentMerchantsCard merchants={risk.recentMerchants} />
        <RecentClosedCard cases={risk.recentClosedCases} />
      </div>
    </div>
  )
}

function RiskCaseTable({
  cases,
  emptyLabel,
}: {
  cases: Array<DashboardRiskCase>
  emptyLabel: string
}) {
  if (cases.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Case</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link
                to="/cases/$caseId"
                params={{ caseId: item.id }}
                className="font-medium hover:underline"
              >
                {item.caseNumber}
              </Link>
              <p className="text-xs text-muted-foreground">
                {item.merchantName}
              </p>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={caseStatusBadgeClasses(item.status)}
              >
                {caseStatusLabel(item.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {item.ownerName ?? 'Unassigned'}
            </TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">
              {formatRelative(item.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RecentMerchantsCard({
  merchants,
}: {
  merchants: Array<DashboardRecentMerchant>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent submissions</CardTitle>
        <CardDescription>Latest merchants onboarded</CardDescription>
      </CardHeader>
      <CardContent>
        {merchants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No recent submissions
          </p>
        ) : (
          <Table>
            <TableBody>
              {merchants.map((merchant) => (
                <TableRow key={merchant.id}>
                  <TableCell>
                    <Link
                      to="/merchants/$merchantId"
                      params={{ merchantId: merchant.id }}
                      className="font-medium hover:underline"
                    >
                      {merchant.businessName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      #{merchant.merchantNumber}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={merchantStatusBadgeClasses(merchant.status)}
                    >
                      {merchantStatusLabel(merchant.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatRelative(merchant.submittedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function RecentClosedCard({
  cases,
}: {
  cases: Array<DashboardRecentClosedCase>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recently closed</CardTitle>
        <CardDescription>Latest resolved cases</CardDescription>
      </CardHeader>
      <CardContent>
        {cases.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No closed cases
          </p>
        ) : (
          <Table>
            <TableBody>
              {cases.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: item.id }}
                      className="font-medium hover:underline"
                    >
                      {item.caseNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.merchantName}
                    </p>
                  </TableCell>
                  <TableCell>
                    {item.closeOutcome === 'successful' ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                      >
                        Successful
                      </Badge>
                    ) : item.closeOutcome === 'unsuccessful' ? (
                      <Badge variant="destructive">Unsuccessful</Badge>
                    ) : (
                      <Badge variant="outline">Closed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatRelative(item.closedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
