import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  advanceStage,
  closeUnsuccessful,
  createCaseComment,
  fetchCaseComments,
  fetchCaseDetail,
  fetchCaseHistory,
  markLiveLimitsApplied,
  markTestingLimitsApplied,
  saveMidCreationDetails,
  saveFieldReviews,
  saveDocumentReviewSubMerchant,
  saveWordpressWebsiteCase,
  sendAgreementEmail,
  sendMidCreationEmail,
  selectSubMerchantForm,
  sendForResubmission,
  takeOwnership,
  uploadAgreementFinalAgreement,
  uploadPhysicalAgreementCopy,
  uploadSubMerchantEmailProof,
  uploadSubMerchantFinalForm,
  fetchResubmissionEmailPreview,
  confirmResubmissionEmailManual,
  fetchAgreementEmailPreview,
  confirmAgreementEmailManual,
  fetchMidCreationEmailPreview,
  confirmMidCreationEmailManual,
  sendLiveEmail,
  fetchLiveEmailPreview,
  confirmLiveEmailManual,
} from '#/apis/cases'
import type { ManualCommunicationChannel } from '#/apis/cases'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { merchantDetailKey } from '#/hooks/use-merchants-query'
import type {
  CloseUnsuccessfulInput,
  CreateCommentInput,
  SaveFieldReviewsInput,
  SaveDocumentReviewSubMerchantInput,
  SendMidCreationEmailInput,
  SendLiveEmailInput,
  SaveMidCreationDetailsInput,
  SelectSubMerchantFormInput,
} from '#/schemas/cases.schema'
import { CASES_KEY, usersQueryOptions } from './use-cases-query'

export const CASE_DETAIL_KEY = ['case-detail'] as const
export const CASE_COMMENTS_KEY = ['case-comments'] as const
export const CASE_HISTORY_KEY = ['case-history'] as const
const CASE_DETAIL_STALE_TIME = 30_000

export function caseDetailQueryOptions(caseId: string) {
  return queryOptions({
    queryKey: [...CASE_DETAIL_KEY, caseId],
    queryFn: () => fetchCaseDetail(caseId),
    enabled: !!caseId,
    staleTime: CASE_DETAIL_STALE_TIME,
  })
}

export function caseCommentsQueryOptions(caseId: string) {
  return queryOptions({
    queryKey: [...CASE_COMMENTS_KEY, caseId],
    queryFn: () => fetchCaseComments(caseId),
    enabled: !!caseId,
    staleTime: CASE_DETAIL_STALE_TIME,
  })
}

export function caseHistoryQueryOptions(caseId: string) {
  return queryOptions({
    queryKey: [...CASE_HISTORY_KEY, caseId],
    queryFn: () => fetchCaseHistory(caseId),
    enabled: !!caseId,
    staleTime: CASE_DETAIL_STALE_TIME,
  })
}

export async function preloadCaseDetailPageQueries(
  queryClient: QueryClient,
  caseId: string,
) {
  const detail = await queryClient.ensureQueryData(
    caseDetailQueryOptions(caseId),
  )

  const { preloadQueueRenderer } = await import(
    '#/features/cases/case-detail/queue-registry'
  )

  await Promise.all([
    preloadQueueRenderer(detail.queue.slug),
    queryClient.prefetchQuery(caseCommentsQueryOptions(caseId)),
    queryClient.prefetchQuery(caseHistoryQueryOptions(caseId)),
    queryClient.prefetchQuery(usersQueryOptions()),
  ])

  return detail
}

export function invalidateCaseWorkflowQueries(
  queryClient: QueryClient,
  caseId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: [...CASE_DETAIL_KEY, caseId],
    }),
    queryClient.invalidateQueries({
      queryKey: [...CASE_HISTORY_KEY, caseId],
    }),
    queryClient.invalidateQueries({ queryKey: CASES_KEY }),
  ])
}

function invalidateCaseDetailQueries(queryClient: QueryClient, caseId: string) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: [...CASE_DETAIL_KEY, caseId],
    }),
    queryClient.invalidateQueries({
      queryKey: [...CASE_HISTORY_KEY, caseId],
    }),
  ])
}

export function useTakeOwnership(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => takeOwnership(caseId),
    onSuccess: async () => {
      await invalidateCaseWorkflowQueries(queryClient, caseId)
      toast.success('Ownership taken successfully')
    },
    onError: () => {
      toast.error('Failed to take ownership')
    },
  })
}

export function useAdvanceStage(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => advanceStage(caseId),
    onSuccess: async () => {
      await invalidateCaseWorkflowQueries(queryClient, caseId)
      toast.success('Stage advanced successfully')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to advance stage'))
    },
  })
}

export function useSaveFieldReviews(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SaveFieldReviewsInput) =>
      saveFieldReviews(caseId, input),
    onSuccess: async () => {
      await invalidateCaseDetailQueries(queryClient, caseId)
      toast.success('Field reviews saved')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to save field reviews'))
    },
  })
}

export function useUploadPhysicalAgreementCopy(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => uploadPhysicalAgreementCopy({ caseId, file }),
    onSuccess: () => {
      toast.success('Physical agreement copy uploaded')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error: unknown) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to upload physical agreement copy'),
      )
    },
  })
}

export function useSaveDocumentReviewSubMerchant(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SaveDocumentReviewSubMerchantInput) =>
      saveDocumentReviewSubMerchant(caseId, input),
    onSuccess: () => {
      toast.success('Sub-merchant saved')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to save sub-merchant'))
    },
  })
}

export function useCloseUnsuccessful(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CloseUnsuccessfulInput) =>
      closeUnsuccessful(caseId, input),
    onSuccess: () => {
      toast.success('Case closed')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: () => {
      toast.error('Failed to close case')
    },
  })
}

export function useCreateComment(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateCommentInput) => createCaseComment(caseId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...CASE_COMMENTS_KEY, caseId],
      })
    },
    onError: () => {
      toast.error('Failed to post comment')
    },
  })
}

export function useSendForResubmission(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => sendForResubmission(caseId),
    onSuccess: async (data) => {
      await invalidateCaseWorkflowQueries(queryClient, caseId)

      if (data.status === 'sent') {
        toast.success('Email sent — case moved to Awaiting Client')
      } else {
        toast.error(
          data.error
            ? `Failed to send email: ${data.error}`
            : 'Failed to send resubmission email',
        )
      }
    },
    onError: (error: unknown) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to send resubmission email'),
      )
    },
  })
}

export function useSelectSubMerchantForm(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SelectSubMerchantFormInput) =>
      selectSubMerchantForm(caseId, input),
    onSuccess: () => {
      toast.success('Sub-merchant selected')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to select sub-merchant'))
    },
  })
}

export function useUploadSubMerchantFinalForm(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { file: File; subMerchantKey: string }) =>
      uploadSubMerchantFinalForm({
        caseId,
        file: input.file,
        subMerchantKey: input.subMerchantKey,
      }),
    onSuccess: () => {
      toast.success('Final Form uploaded')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to upload Final Form'))
    },
  })
}

export function useUploadSubMerchantEmailProof(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { file: File }) =>
      uploadSubMerchantEmailProof({ caseId, file: input.file }),
    onSuccess: () => {
      toast.success('Email proof uploaded')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to upload email proof'))
    },
  })
}

export function useUploadAgreementFinalAgreement(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { file: File }) =>
      uploadAgreementFinalAgreement({
        caseId,
        file: input.file,
      }),
    onSuccess: () => {
      toast.success('Final Agreement uploaded')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to upload Final Agreement'))
    },
  })
}

export function useSendAgreementEmail(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { remarks?: string | null }) =>
      sendAgreementEmail(caseId, input),
    onSuccess: async (data) => {
      await invalidateCaseWorkflowQueries(queryClient, caseId)

      if (data.status === 'sent') {
        toast.success('Agreement email sent')
      } else {
        toast.error(
          data.error
            ? `Failed to send agreement email: ${data.error}`
            : 'Failed to send agreement email',
        )
      }
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to send agreement email'))
    },
  })
}

export function useSendMidCreationEmail(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SendMidCreationEmailInput) =>
      sendMidCreationEmail(caseId, input),
    onSuccess: async (data) => {
      await invalidateCaseWorkflowQueries(queryClient, caseId)

      if (data.status === 'sent') {
        toast.success('MID credentials email sent')
      } else {
        toast.error(
          data.error
            ? `Failed to send MID credentials: ${data.error}`
            : 'Failed to send MID credentials',
        )
      }
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to send MID credentials'))
    },
  })
}

export function useSendLiveEmail(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SendLiveEmailInput) => sendLiveEmail(caseId, input),
    onSuccess: async (data) => {
      await invalidateCaseWorkflowQueries(queryClient, caseId)

      if (data.status === 'sent') {
        toast.success('Live email sent')
      } else {
        toast.error(
          data.error
            ? `Failed to send live email: ${data.error}`
            : 'Failed to send live email',
        )
      }
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to send live email'))
    },
  })
}

export function useFetchResubmissionEmailPreview(caseId: string) {
  return useMutation({
    mutationFn: () => fetchResubmissionEmailPreview(caseId),
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to load email preview'))
    },
  })
}

export function useConfirmResubmissionEmailManual(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      tokenId: string
      file: File
      channel?: ManualCommunicationChannel
    }) => confirmResubmissionEmailManual({ caseId, ...input }),
    onSuccess: async () => {
      await invalidateCaseWorkflowQueries(queryClient, caseId)
      toast.success('Resubmission email marked as sent')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to confirm manual email'))
    },
  })
}

export function useFetchAgreementEmailPreview(caseId: string) {
  return useMutation({
    mutationFn: (input: { remarks?: string | null }) =>
      fetchAgreementEmailPreview(caseId, input),
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to load email preview'))
    },
  })
}

export function useConfirmAgreementEmailManual(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      tokenId: string
      remarks?: string | null
      file: File
      channel?: ManualCommunicationChannel
    }) => confirmAgreementEmailManual({ caseId, ...input }),
    onSuccess: async () => {
      await invalidateCaseWorkflowQueries(queryClient, caseId)
      toast.success('Agreement email marked as sent')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to confirm manual email'))
    },
  })
}

export function useFetchMidCreationEmailPreview(caseId: string) {
  return useMutation({
    mutationFn: (input: SendMidCreationEmailInput) =>
      fetchMidCreationEmailPreview(caseId, input),
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to load email preview'))
    },
  })
}

export function useConfirmMidCreationEmailManual(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      input: {
        tokenId: string
        file: File
        channel?: ManualCommunicationChannel
      } & SendMidCreationEmailInput,
    ) => confirmMidCreationEmailManual({ caseId, ...input }),
    onSuccess: async () => {
      await invalidateCaseWorkflowQueries(queryClient, caseId)
      toast.success('MID credentials email marked as sent')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to confirm manual email'))
    },
  })
}

export function useFetchLiveEmailPreview(caseId: string) {
  return useMutation({
    mutationFn: (input: SendLiveEmailInput) =>
      fetchLiveEmailPreview(caseId, input),
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to load email preview'))
    },
  })
}

export function useConfirmLiveEmailManual(caseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      input: {
        tokenId: string
        file: File
        channel?: ManualCommunicationChannel
      } & SendLiveEmailInput,
    ) => confirmLiveEmailManual({ caseId, ...input }),
    onSuccess: async () => {
      await invalidateCaseWorkflowQueries(queryClient, caseId)
      toast.success('Live email marked as sent')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to confirm manual email'))
    },
  })
}

export function useSaveMidCreationDetails(caseId: string, merchantId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SaveMidCreationDetailsInput) =>
      saveMidCreationDetails(caseId, input),
    onSuccess: () => {
      toast.success('MID details saved')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
      if (merchantId) {
        queryClient.invalidateQueries({
          queryKey: merchantDetailKey(merchantId),
        })
      }
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to save MID details'))
    },
  })
}

export function useMarkTestingLimitsApplied(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => markTestingLimitsApplied(caseId),
    onSuccess: () => {
      toast.success('Testing limits marked as applied')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error: unknown) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to mark testing limits as applied'),
      )
    },
  })
}

export function useMarkLiveLimitsApplied(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => markLiveLimitsApplied(caseId),
    onSuccess: () => {
      toast.success('Live limits marked as applied')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error: unknown) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to mark live limits as applied'),
      )
    },
  })
}

export function useSaveWordpressWebsiteCase(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      clonedWebsiteLink: string
      screenshots: File[]
      subMerchantLogoScreenshots: File[]
    }) =>
      saveWordpressWebsiteCase({
        caseId,
        clonedWebsiteLink: input.clonedWebsiteLink,
        screenshots: input.screenshots,
        subMerchantLogoScreenshots: input.subMerchantLogoScreenshots,
      }),
    onSuccess: () => {
      toast.success('WordPress website details saved')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error: unknown) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to save WordPress website details'),
      )
    },
  })
}
