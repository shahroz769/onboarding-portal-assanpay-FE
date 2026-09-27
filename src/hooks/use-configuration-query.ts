import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'

import {
  createSubMerchantDraft,
  createMissingCloseTriggerCases,
  fetchAgreementDrafts,
  fetchCaseFlowConfiguration,
  fetchEmailRecipients,
  fetchEmailSendingMode,
  fetchEmailTemplatePreview,
  fetchLimitsAndMdr,
  fetchMerchantPortal,
  fetchPaymentMethods,
  fetchPayoutMethods,
  fetchSubMerchantDrafts,
  fetchSubMerchantOptions,
  previewMissingCloseTriggerCases,
  updateCaseFlowConfiguration,
  updateEmailRecipients,
  updateEmailSendingMode,
  updateMerchantPortal,
  updatePaymentMethods,
  updatePayoutMethods,
  updateQueueSla,
  updateSubMerchantDraft,
  uploadAgreementDraft,
} from '#/apis/configuration'
import { CASES_KEY, QUEUES_KEY } from '#/hooks/use-cases-query'
import type {
  CaseFlowConfiguration,
  EmailRecipientSettings,
  EmailSendingMode,
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
export const EMAIL_SENDING_MODE_KEY = [
  ...CONFIGURATION_KEY,
  'email-sending-mode',
] as const
export const EMAIL_RECIPIENTS_KEY = [
  ...CONFIGURATION_KEY,
  'email-recipients',
] as const
export const EMAIL_TEMPLATES_KEY = [
  ...CONFIGURATION_KEY,
  'email-templates',
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

export function emailSendingModeQueryOptions() {
  return queryOptions({
    queryKey: EMAIL_SENDING_MODE_KEY,
    queryFn: fetchEmailSendingMode,
    staleTime: 60_000,
  })
}

// Templates only change with a backend deploy, so a preview never goes stale.
export function emailTemplatePreviewQueryOptions(key: string) {
  return queryOptions({
    queryKey: [...EMAIL_TEMPLATES_KEY, key],
    queryFn: () => fetchEmailTemplatePreview(key),
    staleTime: Infinity,
  })
}

export function emailRecipientsQueryOptions() {
  return queryOptions({
    queryKey: EMAIL_RECIPIENTS_KEY,
    queryFn: fetchEmailRecipients,
    staleTime: 60_000,
  })
}

export function caseFlowConfigurationQueryOptions(versionId?: number) {
  return queryOptions({
    queryKey: versionId
      ? [...CASE_FLOW_CONFIGURATION_KEY, versionId]
      : CASE_FLOW_CONFIGURATION_KEY,
    queryFn: () => fetchCaseFlowConfiguration(versionId),
    staleTime: 60_000,
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

export function useUpdateEmailRecipientsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EmailRecipientSettings) => updateEmailRecipients(input),
    onSuccess: (saved) => {
      queryClient.setQueryData(EMAIL_RECIPIENTS_KEY, saved)
      toast.success('Email recipients saved.')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save email recipients.'))
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
      toast.success(
        'New flow version published. Existing merchants keep their flow.',
      )
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

export function usePreviewMissingCloseTriggerCasesMutation() {
  return useMutation({
    mutationFn: previewMissingCloseTriggerCases,
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to check for missing cases.'),
      )
    },
  })
}

export function useCreateMissingCloseTriggerCasesMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createMissingCloseTriggerCases,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: CASES_KEY })
      if (result.eligibleMerchantCount === 0) {
        toast.success('No missing cases were found.')
        return
      }
      if (result.failedMerchantCount > 0) {
        toast.error(
          `Created cases for ${result.createdMerchantCount} merchant${result.createdMerchantCount === 1 ? '' : 's'}; ${result.failedMerchantCount} failed. See the errors below.`,
        )
        return
      }
      if (result.createdCaseCount === 0) {
        toast.success('The missing cases had already been created.')
        return
      }
      toast.success(
        `Created ${result.createdCaseCount} ${result.trigger.targetQueueName} case${result.createdCaseCount === 1 ? '' : 's'} immediately.`,
      )
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to create missing cases.'))
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

export function useUpdateSubMerchantDraftMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateSubMerchantDraft,
    onSuccess: async () => {
      toast.success('Sub-merchant updated.')
      await queryClient.invalidateQueries({ queryKey: CONFIGURATION_KEY })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update sub-merchant.'))
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
