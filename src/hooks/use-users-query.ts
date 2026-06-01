import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  bulkUpdateUserStatus,
  createUser,
  fetchUser,
  fetchUsers,
  sendUserResetPassword,
  updateUser,
} from '#/apis/users'
import type { UserRouteSearch } from '#/schemas/users.schema'
import { getApiErrorMessage } from '#/lib/get-api-error-message'

export const USERS_KEY = ['users'] as const
export const USER_KEY = ['user'] as const

export function usersQueryOptions(filters: Partial<UserRouteSearch> = {}) {
  return queryOptions({
    queryKey: [...USERS_KEY, filters],
    queryFn: () => fetchUsers(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function userQueryOptions(userId: string) {
  return queryOptions({
    queryKey: [...USER_KEY, userId],
    queryFn: () => fetchUser(userId),
    staleTime: 30_000,
  })
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      toast.success('User created and password email sent.')
      await queryClient.invalidateQueries({ queryKey: USERS_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to create user.'))
    },
  })
}

export function useUpdateUserMutation(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateUser,
    onSuccess: async () => {
      toast.success('User updated.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: USERS_KEY }),
        queryClient.invalidateQueries({ queryKey: [...USER_KEY, userId] }),
      ])
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update user.'))
    },
  })
}

export function useBulkUpdateUserStatusMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkUpdateUserStatus,
    onSuccess: async (_, variables) => {
      toast.success(
        variables.status === 'active'
          ? 'Selected users activated.'
          : 'Selected users deactivated.',
      )
      await queryClient.invalidateQueries({ queryKey: USERS_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update users.'))
    },
  })
}

export function useSendUserResetPasswordMutation() {
  return useMutation({
    mutationFn: sendUserResetPassword,
    onSuccess: () => {
      toast.success('Password reset email sent.')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to send reset email.'))
    },
  })
}
