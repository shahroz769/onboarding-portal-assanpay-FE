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
  saveMidCreationDetails,
  saveFieldReviews,
  saveDocumentReviewSubMerchant,
  saveWordpressWebsiteCase,
  sendAgreementEmail,
  sendMidCreationEmail,
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
import type {
  CaseTransitionResult,
  ManualCommunicationChannel,
} from '#/apis/cases'
import { useAuth } from '#/features/auth/auth-client'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { merchantDetailKey } from '#/hooks/use-merchants-query'
import type {
  CaseDetail,
  CloseUnsuccessfulInput,
  CreateCommentInput,
  SaveFieldReviewsInput,
  SaveDocumentReviewSubMerchantInput,
  SendMidCreationEmailInput,
  SendLiveEmailInput,
  SaveMidCreationDetailsInput,
  EmailRecipientSelection,
  EmailRecipientType,
} from '#/schemas/cases.schema'
import { CASES_KEY } from './use-cases-query'
import { userDirectoryQueryOptions } from './use-users-query'

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
  const detailPromise = queryClient.ensureQueryData(
    caseDetailQueryOptions(caseId),
  )
  const queueRegistryPromise =
    import('#/features/cases/case-detail/queue-registry')
  void queryClient.prefetchQuery(caseCommentsQueryOptions(caseId))
  void queryClient.prefetchQuery(caseHistoryQueryOptions(caseId))
  void queryClient.prefetchQuery(userDirectoryQueryOptions())

  const detail = await detailPromise
  const { preloadQueueRenderer } = await queueRegistryPromise
  await preloadQueueRenderer(detail.queue.workflowType)

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

function applyCaseTransition(
  queryClient: QueryClient,
  caseId: string,
  transition: CaseTransitionResult,
  owner?: { id: string; name: string },
) {
  queryClient.setQueryData<CaseDetail>(
    [...CASE_DETAIL_KEY, caseId],
    (current) => {
      if (!current) return current

      const currentStage =
        current.stages.find(
          (stage) => stage.id === transition.currentStageId,
        ) ?? current.currentStage

      return {
        ...current,
        case: {
          ...current.case,
          status: transition.status,
          closeOutcome: transition.closeOutcome,
          closeReason: transition.closeReason,
          closedAt: transition.closedAt,
          slaBreached: transition.slaBreached,
          updatedAt: transition.updatedAt,
        },
        currentStage,
        owner:
          transition.ownerId === null
            ? null
            : owner?.id === transition.ownerId
              ? owner
              : current.owner,
      }
    },
  )
}

export function useTakeOwnership(caseId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: () => takeOwnership(caseId),
    onSuccess: (transition) => {
      applyCaseTransition(
        queryClient,
        caseId,
        transition,
        user ? { id: user.id, name: user.name } : undefined,
      )
      toast.success('Ownership taken successfully')
    },
    onError: () => {
      toast.error('Failed to take ownership')
    },
    onSettled: () => {
      void invalidateCaseWorkflowQueries(queryClient, caseId)
    },
  })
}

export function useAdvanceStage(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => advanceStage(caseId),
    onSuccess: (transition) => {
      applyCaseTransition(queryClient, caseId, transition)
      toast.success('Stage advanced successfully')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to advance stage'))
    },
    onSettled: () => {
      void invalidateCaseWorkflowQueries(queryClient, caseId)
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
      toast.success('Sub-merchants saved')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to save sub-merchants'))
    },
  })
}

export function useCloseUnsuccessful(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CloseUnsuccessfulInput) =>
      closeUnsuccessful(caseId, input),
    onSuccess: (transition) => {
      applyCaseTransition(queryClient, caseId, transition)
      toast.success('Case closed')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to close case'))
    },
    onSettled: () => {
      void invalidateCaseWorkflowQueries(queryClient, caseId)
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
    mutationFn: (input: EmailRecipientSelection) =>
      sendForResubmission(caseId, input),
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
    mutationFn: (
      input: { remarks?: string | null } & EmailRecipientSelection,
    ) => sendAgreementEmail(caseId, input),
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
    mutationFn: (input: EmailRecipientSelection) =>
      fetchResubmissionEmailPreview(caseId, input),
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
      recipientEmailType: EmailRecipientType
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
    mutationFn: (
      input: { remarks?: string | null } & EmailRecipientSelection,
    ) => fetchAgreementEmailPreview(caseId, input),
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
      recipientEmailType: EmailRecipientType
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
      subMerchantLogoScreenshots: Array<{
        subMerchantId: string
        file: File
      }>
      assanpayCheckoutScreenshots: File[]
    }) =>
      saveWordpressWebsiteCase({
        caseId,
        clonedWebsiteLink: input.clonedWebsiteLink,
        screenshots: input.screenshots,
        subMerchantLogoScreenshots: input.subMerchantLogoScreenshots,
        assanpayCheckoutScreenshots: input.assanpayCheckoutScreenshots,
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
