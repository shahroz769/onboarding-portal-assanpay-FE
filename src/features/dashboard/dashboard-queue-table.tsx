import { Link } from '@tanstack/react-router'

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
import { cn } from '#/lib/utils'
import type { DashboardResponse } from '#/schemas/dashboard.schema'
import { formatCount, formatPercent } from './dashboard-utils'

export function DashboardQueueTable({ data }: { data: DashboardResponse }) {
  const queues = data.queues

  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue workload</CardTitle>
        <CardDescription>
          New, working, pending, closed, and breach rate per queue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Queue</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead className="text-right">Working</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead className="text-right">Breached</TableHead>
              <TableHead className="text-right">Closed</TableHead>
              <TableHead className="text-right">Breach rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queues.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-20 text-center text-muted-foreground"
                >
                  No active queues
                </TableCell>
              </TableRow>
            ) : (
              queues.map((queue) => (
                <TableRow key={queue.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/cases/all-cases"
                      search={{ queueId: queue.id }}
                      className="hover:underline"
                    >
                      {queue.name}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      SLA {queue.slaHours}h
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(queue.new)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(queue.working)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(queue.pending)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {queue.breached > 0 ? (
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {formatCount(queue.breached)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCount(queue.closed)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      queue.breachRate > 10 &&
                        'font-medium text-red-600 dark:text-red-400',
                    )}
                  >
                    {formatPercent(queue.breachRate)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
