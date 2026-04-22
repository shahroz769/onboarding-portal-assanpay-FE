import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  advanceStage,
  closeUnsuccessful,
  createCaseComment,
  fetchCaseComments,
  fetchCaseDetail,
  fetchCaseHistory,
  saveFieldReviews,
  sendForResubmission,
  takeOwnership,
} from '#/apis/cases'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import type {
  CloseUnsuccessfulInput,
  CreateCommentInput,
  SaveFieldReviewsInput,
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
    mutationFn: (input: CreateCommentInput) =>
      createCaseComment(caseId, input),
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
        toast.success(
          'Email sent — case moved to Awaiting Client',
        )
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
