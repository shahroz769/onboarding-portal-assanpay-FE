import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { useAuth } from '#/features/auth/auth-client'
import { useUpdateUserMutation } from '#/hooks/use-users-query'
import type { UserFormValues, UserListItem } from '#/schemas/users.schema'
import { UserForm } from './user-form'

type EditUserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The row being edited; kept after closing so the exit fade shows it. */
  user: UserListItem | null
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
}: EditUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update employee details, status, and queue access.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed by user so the form starts from that user's values. */}
        {user ? (
          <EditUserForm
            key={user.id}
            user={user}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function EditUserForm({
  user,
  onClose,
}: {
  user: UserListItem
  onClose: () => void
}) {
  const { user: currentUser } = useAuth()
  const updateUserMutation = useUpdateUserMutation(user.id)
  const adminViewingSuperAdmin =
    currentUser?.roleType === 'admin' && user.roleType === 'super_admin'

  const handleSubmit = async (value: UserFormValues) => {
    if (adminViewingSuperAdmin) return

    // Email and username can't change after the account is created.
    const { email, username, ...input } = value
    void email
    void username
    await updateUserMutation.mutateAsync({ userId: user.id, input })
    onClose()
  }

  return (
    <UserForm
      mode="edit"
      layout="dialog"
      user={user}
      onSubmit={handleSubmit}
      onCancel={onClose}
      disabled={adminViewingSuperAdmin}
      disabledReason={
        adminViewingSuperAdmin
          ? 'Admins cannot edit Super Admin users.'
          : undefined
      }
    />
  )
}
