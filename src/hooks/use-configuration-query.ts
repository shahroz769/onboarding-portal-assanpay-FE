import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createSubMerchantDraft,
  fetchCaseFlowConfiguration,
  fetchConfiguration,
  fetchSubMerchantOptions,
  updateCaseFlowConfiguration,
  updateEmailSendingMode,
  updateMerchantPortal,
  updatePaymentMethods,
  updatePayoutMethods,
  updateLimitsAndMdr,
  updateLinkDeadlines,
  updateQueueSla,
  updateQueueStatus,
  uploadAgreementDraft,
} from '#/apis/configuration'
import { QUEUES_KEY } from '#/hooks/use-cases-query'
import type {
  CaseFlowConfiguration,
  EmailSendingMode,
  LimitsAndMdrSettings,
  LinkDeadlineSettings,
  MerchantPortalSettings,
  PaymentMethodSettings,
} from '#/schemas/configuration.schema'
import { getApiErrorMessage } from '#/lib/get-api-error-message'

export const CONFIGURATION_KEY = ['configuration'] as const
export const SUB_MERCHANT_OPTIONS_KEY = [
  ...CONFIGURATION_KEY,
  'sub-merchants',
] as const
export const CASE_FLOW_CONFIGURATION_KEY = [
  'configuration',
  'case-flow',
] as const

export function configurationQueryOptions() {
  return queryOptions({
    queryKey: CONFIGURATION_KEY,
    queryFn: fetchConfiguration,
    staleTime: 60_000,
  })
}

export function subMerchantOptionsQueryOptions() {
  return queryOptions({
    queryKey: SUB_MERCHANT_OPTIONS_KEY,
    queryFn: fetchSubMerchantOptions,
    staleTime: 60_000,
  })
}

export function caseFlowConfigurationQueryOptions() {
  return queryOptions({
    queryKey: CASE_FLOW_CONFIGURATION_KEY,
    queryFn: fetchCaseFlowConfiguration,
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

export function useUpdateEmailSendingModeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EmailSendingMode) => updateEmailSendingMode(input),
    onSuccess: async () => {
      toast.success('Email sending mode saved.')
      await queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY })
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to save email sending mode.'),
      )
    },
  })
}

export function useUpdateMerchantPortalMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MerchantPortalSettings) => updateMerchantPortal(input),
    onSuccess: async () => {
      toast.success('Merchant portal settings saved.')
      await queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY })
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to save merchant portal settings.'),
      )
    },
  })
}

export function useUpdatePaymentMethodsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentMethodSettings) => updatePaymentMethods(input),
    onSuccess: async () => {
      toast.success('Payment methods saved.')
      await queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save payment methods.'))
    },
  })
}

export function useUpdatePayoutMethodsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentMethodSettings) => updatePayoutMethods(input),
    onSuccess: async () => {
      toast.success('Payout methods saved.')
      await queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save payout methods.'))
    },
  })
}

export function useUpdateCaseFlowConfigurationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CaseFlowConfiguration) =>
      updateCaseFlowConfiguration(input),
    onSuccess: async () => {
      toast.success('Case flow rules saved.')
      await queryClient.invalidateQueries({
        queryKey: CASE_FLOW_CONFIGURATION_KEY,
      })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save case flow rules.'))
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

export function useUpdateQueueSlaMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateQueueSla,
    onSuccess: async () => {
      toast.success('Queue SLA updated.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY }),
        queryClient.invalidateQueries({ queryKey: QUEUES_KEY }),
      ])
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update queue SLA.'))
    },
  })
}
