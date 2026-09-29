import { useState } from 'react'
import { Bell } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
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
      <PopoverTrigger
        render={
          <Button
            variant="secondary"
            size="icon"
            className="relative rounded-full hover:bg-foreground/10 dark:hover:bg-foreground/15"
            aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
          />
        }
      >
        <Bell />
        {hasUnread ? (
          <Badge
            className={cn(
              'absolute -top-0.5 -right-0.5 rounded-full text-[10px] leading-none tabular-nums',
              // Pops in when unread first appears; count changes don't animate.
              'transition-[opacity,scale] duration-150 ease-out starting:scale-90 starting:opacity-0 motion-reduce:transition-opacity',
              displayCount.length === 1
                ? 'size-4.5 p-0'
                : 'h-4.5 min-w-4.5 px-1',
            )}
            variant="destructive"
          >
            {displayCount}
          </Badge>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-100 max-w-[calc(100vw-2rem)] p-0"
      >
        <NotificationsPopoverContent
          onNavigate={() => setOpen(false)}
          unreadCount={unreadCount}
        />
      </PopoverContent>
    </Popover>
  )
}
