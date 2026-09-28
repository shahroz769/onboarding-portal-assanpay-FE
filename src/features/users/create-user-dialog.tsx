import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import type { MorphPopupProps } from '#/hooks/use-morph'
import { useCreateUserMutation } from '#/hooks/use-users-query'
import { cn } from '#/lib/utils'
import type { UserFormValues } from '#/schemas/users.schema'
import { UserForm } from './user-form'

type CreateUserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** From useMorph: the dialog grows out of its trigger button. */
  popupProps?: MorphPopupProps
}

export function CreateUserDialog({
  open,
  onOpenChange,
  popupProps,
}: CreateUserDialogProps) {
  const createUserMutation = useCreateUserMutation()

  const handleSubmit = async (value: UserFormValues) => {
    await createUserMutation.mutateAsync(value)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...popupProps}
        className={cn(
          'flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl',
          popupProps?.className,
        )}
      >
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
