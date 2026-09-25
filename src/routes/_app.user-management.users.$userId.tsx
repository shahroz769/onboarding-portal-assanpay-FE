import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { UserForm } from '#/features/users/user-form'
import { useAuth } from '#/features/auth/auth-client'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import {
  userQueryOptions,
  useUpdateUserMutation,
} from '#/hooks/use-users-query'
import type { UserFormValues } from '#/schemas/users.schema'

export const Route = createFileRoute('/_app/user-management/users/$userId')({
  staticData: {
    title: 'Edit User',
    subtitle: 'Update employee details, status, and queue access.',
  },
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(queuesQueryOptions()),
      context.queryClient.ensureQueryData(userQueryOptions(params.userId)),
    ])
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { userId } = Route.useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const { data: user } = useSuspenseQuery(userQueryOptions(userId))
  const updateUserMutation = useUpdateUserMutation(userId)
  const adminViewingSuperAdmin =
    currentUser?.roleType === 'admin' && user.roleType === 'super_admin'

  const handleSubmit = async (value: UserFormValues) => {
    if (adminViewingSuperAdmin) return

    const { email, username, ...input } = value
    void email
    void username
    await updateUserMutation.mutateAsync({ userId, input })
    await navigate({ to: '/user-management' })
  }

  return (
    <UserForm
      mode="edit"
      user={user}
      onSubmit={handleSubmit}
      disabled={adminViewingSuperAdmin}
      disabledReason={
        adminViewingSuperAdmin
          ? 'Admins cannot edit Super Admin users.'
          : undefined
      }
    />
  )
}
