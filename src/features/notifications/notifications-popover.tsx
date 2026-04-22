import { useState } from 'react'
import { CheckCheck } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useMarkAllNotificationsReadMutation } from '#/hooks/use-notifications-query'
import type { NotificationFilter } from '#/schemas/notifications.schema'

import { NotificationList } from './notification-list'

interface NotificationsPopoverContentProps {
  onNavigate: () => void
  unreadCount: number
}

export function NotificationsPopoverContent({
  onNavigate,
  unreadCount,
}: NotificationsPopoverContentProps) {
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const markAll = useMarkAllNotificationsReadMutation()

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 ? (
            <span className="text-xs text-muted-foreground">
              {unreadCount} unread
            </span>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={unreadCount === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck className="size-3.5" />
          Mark all read
        </Button>
      </div>

      <Separator />

      <div className="px-3 pt-2 pb-2">
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as NotificationFilter)}
        >
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Unread
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <NotificationList filter={filter} onNavigate={onNavigate} />
    </div>
  )
}
