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
  saveFieldReviews,
  saveWordpressWebsiteCase,
  sendAgreementEmail,
  sendMidCreationEmail,
  selectSubMerchantForm,
  sendForResubmission,
  sendSubMerchantFormEmail,
  takeOwnership,
  uploadAgreementFinalAgreement,
  uploadSubMerchantFinalForm,
} from '#/apis/cases'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import type {
  CloseUnsuccessfulInput,
  CreateCommentInput,
  SaveFieldReviewsInput,
  SendMidCreationEmailInput,
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
  const detailPromise = queryClient.ensureQueryData(
    caseDetailQueryOptions(caseId),
  )

  void queryClient.prefetchQuery(caseCommentsQueryOptions(caseId))
  void queryClient.prefetchQuery(caseHistoryQueryOptions(caseId))
  void queryClient.prefetchQuery(usersQueryOptions())

  return detailPromise
}

export function useTakeOwnership(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => takeOwnership(caseId),
    onSuccess: () => {
      toast.success('Ownership taken successfully')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
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
    onSuccess: () => {
      toast.success('Stage advanced successfully')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: () => {
      toast.error('Failed to advance stage')
    },
  })
}

export function useSaveFieldReviews(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SaveFieldReviewsInput) =>
      saveFieldReviews(caseId, input),
    onSuccess: () => {
      toast.success('Field reviews saved')
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to save field reviews'))
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
    onSuccess: (data) => {
      if (data.status === 'sent') {
        toast.success('Email sent — case moved to Awaiting Client')
      } else {
        toast.error(
          data.error
            ? `Failed to send email: ${data.error}`
            : 'Failed to send resubmission email',
        )
      }
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
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

export function useSendSubMerchantFormEmail(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => sendSubMerchantFormEmail(caseId),
    onSuccess: (data) => {
      if (data.status === 'sent') {
        toast.success('Email sent')
      } else {
        toast.error(
          data.error
            ? `Failed to send email: ${data.error}`
            : 'Failed to send email',
        )
      }
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to send email'))
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
    onSuccess: (data) => {
      if (data.status === 'sent') {
        toast.success('Agreement email sent')
      } else {
        toast.error(
          data.error
            ? `Failed to send agreement email: ${data.error}`
            : 'Failed to send agreement email',
        )
      }
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
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
    onSuccess: (data) => {
      if (data.status === 'sent') {
        toast.success('MID credentials email sent')
      } else {
        toast.error(
          data.error
            ? `Failed to send MID credentials: ${data.error}`
            : 'Failed to send MID credentials',
        )
      }
      queryClient.invalidateQueries({ queryKey: [...CASE_DETAIL_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: [...CASE_HISTORY_KEY, caseId] })
      queryClient.invalidateQueries({ queryKey: CASES_KEY })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to send MID credentials'))
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
    mutationFn: (input: { clonedWebsiteLink: string; screenshots: File[] }) =>
      saveWordpressWebsiteCase({
        caseId,
        clonedWebsiteLink: input.clonedWebsiteLink,
        screenshots: input.screenshots,
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
