import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { CaseDetail } from '#/schemas/cases.schema'

import {
  createDocumentsReviewDraft,
  getDocumentsReviewSummaryFromDraft,
  type DocumentsReviewDraftMap,
} from './documents-review-shared'

type DocumentsReviewDraftContextValue = {
  draftReviews: DocumentsReviewDraftMap
  reviewSummary: ReturnType<typeof getDocumentsReviewSummaryFromDraft>
  saveRejectedReview: (fieldName: string, remarks: string) => void
  clearRejectedReview: (fieldName: string) => void
}

const DocumentsReviewDraftContext =
  createContext<DocumentsReviewDraftContextValue | null>(null)

export function DocumentsReviewDraftProvider({
  caseDetail,
  children,
}: {
  caseDetail: CaseDetail
  children: ReactNode
}) {
  const [draftReviews, setDraftReviews] = useState(() =>
    createDocumentsReviewDraft(caseDetail.fieldReviews),
  )

  useEffect(() => {
    startTransition(() => {
      setDraftReviews(createDocumentsReviewDraft(caseDetail.fieldReviews))
    })
  }, [caseDetail.fieldReviews])

  const value = useMemo<DocumentsReviewDraftContextValue>(() => ({
    draftReviews,
    reviewSummary: getDocumentsReviewSummaryFromDraft(caseDetail, draftReviews),
    saveRejectedReview: (fieldName, remarks) => {
      setDraftReviews((currentDraft) => ({
        ...currentDraft,
        [fieldName]: {
          status: 'rejected',
          remarks,
        },
      }))
    },
    clearRejectedReview: (fieldName) => {
      setDraftReviews((currentDraft) => ({
        ...currentDraft,
        [fieldName]: {
          status: 'pending',
          remarks: '',
        },
      }))
    },
  }), [caseDetail, draftReviews])

  return (
    <DocumentsReviewDraftContext.Provider value={value}>
      {children}
    </DocumentsReviewDraftContext.Provider>
  )
}

export function useDocumentsReviewDraft() {
  const context = useContext(DocumentsReviewDraftContext)

  if (!context) {
    throw new Error(
      'useDocumentsReviewDraft must be used within DocumentsReviewDraftProvider',
    )
  }

  return context
}

export function useOptionalDocumentsReviewDraft() {
  return useContext(DocumentsReviewDraftContext)
}
