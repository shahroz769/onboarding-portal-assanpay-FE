import { LogOut } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAuth } from '#/features/auth/auth-client'
import { useLogoutMutation } from '#/features/auth/auth-query'
import { USER_ROLE_ICONS } from '#/features/users/user-role-icons'
import { getUserAvatarSrc, getUserInitials } from '#/lib/user-avatar'
import { USER_ROLE_LABELS } from '#/schemas/users.schema'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

/** First letters of the first and last name, e.g. "Jane Q Doe" -> "JD". */
function getFirstLastInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (parts[0][0] + last).toUpperCase()
}

/** Account menu at the right end of the top bar. */
export function NavUser() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const logoutMutation = useLogoutMutation()
  const queryClient = useQueryClient()

  if (!user) return null

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync()
      await navigate({ to: '/login' })
      // After navigating, so the unmounted app queries don't refetch tokenless.
      queryClient.clear()
    } catch {
      toast.error(
        'Logout failed. Your session is still active; please try again.',
      )
    }
  }

  const avatarSrc = getUserAvatarSrc(user.gender)
  const initials = getUserInitials(user.name)
  const RoleIcon = USER_ROLE_ICONS[user.roleType]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="secondary"
            size="icon"
            className="text-xs font-medium rounded-full hover:bg-foreground/10 dark:hover:bg-foreground/15"
            aria-label={`Account: ${user.name}`}
          />
        }
      >
        {getFirstLastInitials(user.name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="size-10">
                <AvatarImage src={avatarSrc} alt="" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <RoleIcon className="size-3" />
                  {USER_ROLE_LABELS[user.roleType]}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
