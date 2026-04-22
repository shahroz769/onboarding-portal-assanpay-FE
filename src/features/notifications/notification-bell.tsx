import { useState } from 'react'
import { Bell } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { useUnreadCountQuery } from '#/hooks/use-notifications-query'
import { cn } from '#/lib/utils'

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
              className={cn(
                'absolute -top-1 -right-1 rounded-full text-[10px] leading-none tabular-nums',
                displayCount.length === 1
                  ? 'size-5 p-0'
                  : 'h-5 min-w-5 px-1.5',
              )}
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
