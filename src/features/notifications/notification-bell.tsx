import { useState } from 'react'
import { Bell } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { useUnreadCountQuery } from '#/hooks/use-notifications-query'

import { NotificationsPopoverContent } from './notifications-popover'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data: unreadCount = 0 } = useUnreadCountQuery()

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount)
  const hasUnread = unreadCount > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell />
          {hasUnread ? (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1 text-[10px] tabular-nums"
              variant="destructive"
            >
              {displayCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[400px] max-w-[calc(100vw-2rem)] p-0"
      >
        <NotificationsPopoverContent
          onNavigate={() => setOpen(false)}
          unreadCount={unreadCount}
        />
      </PopoverContent>
    </Popover>
  )
}
