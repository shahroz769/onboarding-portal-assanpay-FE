import { AxiosError } from 'axios'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePrefetchQuery, useQuery } from '@tanstack/react-query'
import { FileQuestion } from 'lucide-react'

import { DefaultRouteError } from '#/components/default-route-error'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { ButtonLink } from '#/components/ui/button'
import { UserForm, UserFormSkeleton } from '#/features/users/user-form'
import { useAuth } from '#/features/auth/auth-client'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import {
  userQueryOptions,
  useUpdateUserMutation,
} from '#/hooks/use-users-query'
import type { UserFormValues } from '#/schemas/users.schema'
import { parseUuidParam } from '#/lib/route-params'

export const Route = createFileRoute('/_app/user-management/users/$userId')({
  params: {
    parse: ({ userId }) => ({ userId: parseUuidParam(userId) }),
  },
  staticData: {
    title: 'Edit User',
    subtitle: 'Update employee details, status, and queue access.',
  },
  pendingMs: 0,
  pendingComponent: UserFormSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const { userId } = Route.useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  // UserForm reads queues itself; start that request now, alongside the user,
  // instead of after the user arrives and the form mounts.
  usePrefetchQuery(queuesQueryOptions())
  const userQuery = useQuery(userQueryOptions(userId))
  const updateUserMutation = useUpdateUserMutation(userId)
  const user = userQuery.data

  if (userQuery.error && !user) {
    if (
      userQuery.error instanceof AxiosError &&
      userQuery.error.response?.status === 404
    ) {
      return <UserNotFound userId={userId} />
    }

    return (
      <DefaultRouteError
        error={userQuery.error}
        onRetry={() => void userQuery.refetch()}
      />
    )
  }

  if (!user) {
    return <UserFormSkeleton />
  }

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

function UserNotFound({ userId }: { userId: string }) {
  return (
    <div className="flex max-w-2xl flex-col items-start gap-4">
      <Alert variant="warning">
        <FileQuestion />
        <AlertTitle>User not found</AlertTitle>
        <AlertDescription>
          User {userId} could not be found. They may have been removed or you
          may be using an old link.
        </AlertDescription>
      </Alert>
      <ButtonLink variant="outline" render={<Link to="/user-management" />}>
        Back to users
      </ButtonLink>
    </div>
  )
}
