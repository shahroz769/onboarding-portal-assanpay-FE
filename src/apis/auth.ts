import axios from 'axios'

import type { LoginResponse, RefreshResponse } from '#/types/auth'
import { API_BASE_URL, apiClient } from '#/lib/api-client'

type LoginRequest = {
  identifier: string
  password: string
}

export async function loginRequest(input: LoginRequest) {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/login', input)
  return data
}

export async function refreshSessionRequest() {
  const { data } = await axios.post<RefreshResponse>(
    `${API_BASE_URL}/api/auth/refresh`,
    {},
    { withCredentials: true }
  )

  return data
}

export async function logoutRequest() {
  await apiClient.post('/api/auth/logout')
}
