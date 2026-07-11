import type { LoginResponse } from '#/types/auth'
import { apiClient } from '#/lib/api-client'
import type { SetPasswordValues } from '#/schemas/users.schema'

type LoginRequest = {
  identifier: string
  password: string
}

export async function loginRequest(input: LoginRequest) {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/login', input)
  return data
}

export async function logoutRequest() {
  await apiClient.post('/api/auth/logout')
}

export async function fetchPasswordToken(token: string) {
  const { data } = await apiClient.get<{
    name: string
    email: string
    purpose: 'invite' | 'reset'
    expiresAt: string
  }>(`/api/auth/password-token/${token}`)
  return data
}

export async function setPasswordRequest(
  token: string,
  input: SetPasswordValues,
) {
  const { data } = await apiClient.post('/api/auth/set-password', {
    token,
    ...input,
  })
  return data
}
