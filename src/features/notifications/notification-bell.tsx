import { useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { CatchBoundary, useLocation } from '@tanstack/react-router'

import { NumberFlip } from '#/components/number-flip'
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

const formatBadgeCount = (count: number) => (count > 99 ? '99+' : String(count))

/**
 * The bell is a header widget: if it crashes, show a quiet placeholder rather
 * than letting the error take down the whole app shell. Navigating retries it.
 */
export function NotificationBell() {
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <CatchBoundary
      getResetKey={() => pathname}
      errorComponent={NotificationBellUnavailable}
    >
      <NotificationBellButton />
    </CatchBoundary>
  )
}

function NotificationBellUnavailable() {
  return (
    <Button
      variant="secondary"
      size="icon"
      className="rounded-full"
      disabled
      aria-label="Notifications unavailable"
      title="Notifications unavailable"
    >
      <Bell />
    </Button>
  )
}

function NotificationBellButton() {
  const [open, setOpen] = useState(false)
  const { data: unreadCount = 0 } = useUnreadCountQuery()

  const hasUnread = unreadCount > 0

  // Keep the last count visible while the badge animates out at 0.
  const lastCount = useRef(unreadCount)
  if (hasUnread) lastCount.current = unreadCount
  const shownValue = Math.min(hasUnread ? unreadCount : lastCount.current, 100)
  const shownLength = formatBadgeCount(shownValue).length

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
        {/* Always mounted so the badge can animate out; slides + pops in when
            unread first appears, count changes roll (NumberFlip). */}
        <span className="t-badge" data-open={hasUnread} aria-hidden>
          <Badge
            className={cn(
              't-badge-dot rounded-full text-[10px] leading-none tabular-nums',
              shownLength === 1 ? 'size-4.5 p-0' : 'h-4.5 min-w-4.5 px-1',
            )}
            variant="destructive"
          >
            <NumberFlip
              value={shownValue}
              format={formatBadgeCount}
              className="leading-none"
            />
          </Badge>
        </span>
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
