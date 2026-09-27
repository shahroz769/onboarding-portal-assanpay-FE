import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { Check } from 'lucide-react'

import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { useMarkNotificationReadMutation } from '#/hooks/use-notifications-query'
import { cn } from '#/lib/utils'
import type { Notification } from '#/schemas/notifications.schema'

import { resolveNotificationTarget } from './notification-target'

interface NotificationItemProps {
  notification: Notification
  onNavigate: () => void
}

function getInitials(name: string | null): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '·'
}

export function NotificationItem({
  notification,
  onNavigate,
}: NotificationItemProps) {
  const markRead = useMarkNotificationReadMutation()
  const target = resolveNotificationTarget(notification)

  function markUnread() {
    if (!notification.isRead) {
      markRead.mutate(notification.id)
    }
  }

  const relativeTime = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  })

  const body = (
    <>
      {/* Same height as the title's first line, so the dot sits centered on it. */}
      <span
        aria-hidden="true"
        className="flex h-5 w-2 shrink-0 items-center justify-center"
      >
        {!notification.isRead ? (
          <span className="size-2 rounded-full bg-primary" />
        ) : null}
      </span>

      {notification.actorName ? (
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="text-[10px]">
            {getInitials(notification.actorName)}
          </AvatarFallback>
        </Avatar>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p
          className={cn(
            'text-sm leading-5',
            !notification.isRead ? 'font-semibold' : 'font-medium',
          )}
        >
          {notification.title}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {notification.body}
        </p>
        <span className="mt-0.5 flex h-6 items-center text-[11px] text-muted-foreground/80">
          {relativeTime}
        </span>
      </div>
    </>
  )

  const rowClassName = cn(
    'flex min-w-0 flex-1 gap-2.5 rounded-lg py-2.5 pr-3 pl-2 text-left transition-colors',
    'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
    !notification.isRead && 'bg-primary/5',
  )

  return (
    <div className="group relative flex">
      {target ? (
        <Link
          to={target.to}
          params={target.params}
          className={rowClassName}
          onClick={() => {
            markUnread()
            onNavigate()
          }}
        >
          {body}
        </Link>
      ) : (
        <div className={rowClassName}>{body}</div>
      )}

      {/* Sits on the timestamp line, clear of the title and body text. */}
      {!notification.isRead ? (
        <Button
          variant="ghost"
          size="xs"
          className="absolute right-2 bottom-2.5 text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-foreground pointer-coarse:opacity-100"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            markRead.mutate(notification.id)
          }}
        >
          <Check />
          Mark as read
        </Button>
      ) : null}
    </div>
  )
}
