import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { useCreateUserMutation } from '#/hooks/use-users-query'
import type { UserFormValues } from '#/schemas/users.schema'
import { UserForm } from './user-form'

type CreateUserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateUserDialog({
  open,
  onOpenChange,
}: CreateUserDialogProps) {
  const createUserMutation = useCreateUserMutation()

  const handleSubmit = async (value: UserFormValues) => {
    await createUserMutation.mutateAsync(value)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Create an employee account and send the password setup email.
          </DialogDescription>
        </DialogHeader>
        <UserForm
          mode="create"
          layout="dialog"
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
