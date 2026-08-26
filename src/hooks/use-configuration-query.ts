import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'

import {
  createQueue,
  createSubMerchantDraft,
  fetchAgreementDrafts,
  fetchCaseFlowConfiguration,
  fetchEmailSendingMode,
  fetchLimitsAndMdr,
  fetchLinkDeadlines,
  fetchMerchantPortal,
  fetchPaymentMethods,
  fetchPayoutMethods,
  fetchQueueDetail,
  fetchSubMerchantDrafts,
  fetchSubMerchantOptions,
  updateCaseFlowConfiguration,
  updateEmailSendingMode,
  updateMerchantPortal,
  updatePaymentMethods,
  updatePayoutMethods,
  updateLimitsAndMdr,
  updateLinkDeadlines,
  updateQueue,
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
  PayoutMethodSettings,
} from '#/schemas/configuration.schema'
import { getApiErrorMessage } from '#/lib/get-api-error-message'

export const CONFIGURATION_KEY = ['configuration'] as const
export const SUB_MERCHANT_OPTIONS_KEY = [
  ...CONFIGURATION_KEY,
  'sub-merchants',
] as const
export const LIMITS_AND_MDR_KEY = [
  ...CONFIGURATION_KEY,
  'limits-and-mdr',
] as const
export const PAYMENT_METHODS_KEY = [
  ...CONFIGURATION_KEY,
  'payment-methods',
] as const
export const PAYOUT_METHODS_KEY = [
  ...CONFIGURATION_KEY,
  'payout-methods',
] as const
export const AGREEMENT_DRAFTS_KEY = [
  ...CONFIGURATION_KEY,
  'agreements',
] as const
export const SUB_MERCHANT_DRAFTS_KEY = [
  ...CONFIGURATION_KEY,
  'sub-merchant-drafts',
] as const
export const MERCHANT_PORTAL_KEY = [
  ...CONFIGURATION_KEY,
  'merchant-portal',
] as const
export const LINK_DEADLINES_KEY = [
  ...CONFIGURATION_KEY,
  'link-deadlines',
] as const
export const EMAIL_SENDING_MODE_KEY = [
  ...CONFIGURATION_KEY,
  'email-sending-mode',
] as const
export const CASE_FLOW_CONFIGURATION_KEY = [
  'configuration',
  'case-flow',
] as const

export function isCaseFlowRevisionConflict(error: unknown) {
  if (!(error instanceof AxiosError) || error.response?.status !== 409) {
    return false
  }
  const data = error.response.data
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    'revision' in data &&
    typeof data.revision === 'number'
  )
}

export function subMerchantOptionsQueryOptions() {
  return queryOptions({
    queryKey: SUB_MERCHANT_OPTIONS_KEY,
    queryFn: fetchSubMerchantOptions,
    staleTime: 60_000,
  })
}

export function limitsAndMdrQueryOptions() {
  return queryOptions({
    queryKey: LIMITS_AND_MDR_KEY,
    queryFn: fetchLimitsAndMdr,
    staleTime: 60_000,
  })
}

export function paymentMethodsQueryOptions() {
  return queryOptions({
    queryKey: PAYMENT_METHODS_KEY,
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  })
}

export function payoutMethodsQueryOptions() {
  return queryOptions({
    queryKey: PAYOUT_METHODS_KEY,
    queryFn: fetchPayoutMethods,
    staleTime: 60_000,
  })
}

export function agreementDraftsQueryOptions() {
  return queryOptions({
    queryKey: AGREEMENT_DRAFTS_KEY,
    queryFn: fetchAgreementDrafts,
    staleTime: 60_000,
  })
}

export function subMerchantDraftsQueryOptions() {
  return queryOptions({
    queryKey: SUB_MERCHANT_DRAFTS_KEY,
    queryFn: fetchSubMerchantDrafts,
    staleTime: 60_000,
  })
}

export function merchantPortalQueryOptions() {
  return queryOptions({
    queryKey: MERCHANT_PORTAL_KEY,
    queryFn: fetchMerchantPortal,
    staleTime: 60_000,
  })
}

export function linkDeadlinesQueryOptions() {
  return queryOptions({
    queryKey: LINK_DEADLINES_KEY,
    queryFn: fetchLinkDeadlines,
    staleTime: 60_000,
  })
}

export function emailSendingModeQueryOptions() {
  return queryOptions({
    queryKey: EMAIL_SENDING_MODE_KEY,
    queryFn: fetchEmailSendingMode,
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
    onSuccess: async (savedSettings) => {
      queryClient.setQueryData(MERCHANT_PORTAL_KEY, savedSettings)
      toast.success('Merchant integration settings saved.')
      await queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY })
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(
          error,
          'Failed to save merchant integration settings.',
        ),
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
    mutationFn: (input: PayoutMethodSettings) => updatePayoutMethods(input),
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
      if (isCaseFlowRevisionConflict(error)) return
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

export function useCreateQueueMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createQueue,
    onSuccess: async () => {
      toast.success('Queue created as draft.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY }),
        queryClient.invalidateQueries({ queryKey: QUEUES_KEY }),
        queryClient.invalidateQueries({
          queryKey: CASE_FLOW_CONFIGURATION_KEY,
        }),
      ])
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to create queue.'))
    },
  })
}

export function useUpdateQueueMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateQueue,
    onSuccess: async (_data, variables) => {
      toast.success('Queue updated.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY }),
        queryClient.invalidateQueries({ queryKey: QUEUES_KEY }),
        queryClient.invalidateQueries({
          queryKey: ['queue-detail', variables.queueId],
        }),
        queryClient.invalidateQueries({
          queryKey: CASE_FLOW_CONFIGURATION_KEY,
        }),
      ])
    },
    onError: (error) => {
      if (isQueueRevisionConflict(error)) return
      toast.error(getApiErrorMessage(error, 'Failed to update queue.'))
    },
  })
}

export function queueDetailQueryOptions(queueId: string) {
  return queryOptions({
    queryKey: ['queue-detail', queueId] as const,
    queryFn: () => fetchQueueDetail(queueId),
    staleTime: 30_000,
    enabled: Boolean(queueId),
  })
}

export function isQueueRevisionConflict(error: unknown) {
  if (!(error instanceof AxiosError) || error.response?.status !== 409) {
    return false
  }
  const data = error.response.data
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    'revision' in data &&
    typeof data.revision === 'number'
  )
}
