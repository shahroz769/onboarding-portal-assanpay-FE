import { useNavigate } from '@tanstack/react-router'
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
  const navigate = useNavigate()
  const markRead = useMarkNotificationReadMutation()

  const handleClick = () => {
    const target = resolveNotificationTarget(notification)
    if (!notification.isRead) {
      markRead.mutate(notification.id)
    }
    if (target) {
      onNavigate()
      void navigate(target)
    }
  }

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (notification.isRead) return
    markRead.mutate(notification.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const relativeTime = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  })

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative flex cursor-pointer gap-3 px-4 py-3 text-left transition-colors',
        'border-b border-border/40 last:border-b-0',
        'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
        !notification.isRead && 'bg-primary/[0.04]',
      )}
    >
      {!notification.isRead ? (
        <span
          aria-hidden="true"
          className="absolute top-4 left-1.5 size-1.5 rounded-full bg-primary"
        />
      ) : null}

      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-[11px]">
          {getInitials(notification.actorName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm leading-snug',
              !notification.isRead ? 'font-semibold' : 'font-medium',
            )}
          >
            {notification.title}
          </p>
          {!notification.isRead ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={handleMarkRead}
              aria-label="Mark as read"
            >
              <Check className="size-3.5" />
            </Button>
          ) : null}
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {notification.body}
        </p>
        <span className="mt-0.5 text-[11px] text-muted-foreground/80">
          {relativeTime}
        </span>
      </div>
    </div>
  )
}
