import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { UserForm } from '#/features/users/user-form'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { useCreateUserMutation } from '#/hooks/use-users-query'
import type { UserFormValues } from '#/schemas/users.schema'

export const Route = createFileRoute('/_app/user-management/user-creation')({
  staticData: {
    title: 'User Creation',
    subtitle: 'Create an employee account and send the password setup email.',
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(queuesQueryOptions())
  },
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const createUserMutation = useCreateUserMutation()

  const handleSubmit = async (value: UserFormValues) => {
    await createUserMutation.mutateAsync(value)
    await navigate({ to: '/user-management/all-users' })
  }

  return <UserForm mode="create" onSubmit={handleSubmit} />
}
