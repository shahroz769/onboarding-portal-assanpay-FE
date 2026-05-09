import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createSubMerchantDraft,
  fetchConfiguration,
  updateLimitsAndMdr,
  updateLinkDeadlines,
  updateQueueStatus,
  uploadAgreementDraft,
} from '#/apis/configuration'
import { QUEUES_KEY } from '#/hooks/use-cases-query'
import type {
  LimitsAndMdrSettings,
  LinkDeadlineSettings,
} from '#/schemas/configuration.schema'
import { getApiErrorMessage } from '#/lib/get-api-error-message'

export const CONFIGURATION_KEY = ['configuration'] as const

export function configurationQueryOptions() {
  return queryOptions({
    queryKey: CONFIGURATION_KEY,
    queryFn: fetchConfiguration,
    staleTime: 60_000,
  })
}

export function useUpdateLimitsAndMdrMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LimitsAndMdrSettings) => updateLimitsAndMdr(input),
    onSuccess: async () => {
      toast.success('Limits and MDR saved.')
      await queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save limits and MDR.'))
    },
  })
}

export function useUpdateLinkDeadlinesMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LinkDeadlineSettings) => updateLinkDeadlines(input),
    onSuccess: async () => {
      toast.success('Link deadlines saved.')
      await queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save link deadlines.'))
    },
  })
}

export function useUploadAgreementDraftMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadAgreementDraft,
    onSuccess: async () => {
      toast.success('Agreement draft uploaded.')
      await queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY })
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to upload agreement draft.'),
      )
    },
  })
}

export function useCreateSubMerchantDraftMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSubMerchantDraft,
    onSuccess: async () => {
      toast.success('Sub-merchant draft added.')
      await queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to add sub-merchant.'))
    },
  })
}

export function useUpdateQueueStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateQueueStatus,
    onSuccess: async () => {
      toast.success('Queue status updated.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY }),
        queryClient.invalidateQueries({ queryKey: QUEUES_KEY }),
      ])
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update queue status.'))
    },
  })
}
