import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import type { CaseDetail } from '#/schemas/cases.schema'

import {
  createDocumentsReviewDraft,
  getDocumentsReviewSummaryFromDraft,
} from './documents-review-shared'
import type { DocumentsReviewDraftMap } from './documents-review-shared'

type DocumentsReviewDraftContextValue = {
  draftReviews: DocumentsReviewDraftMap
  reviewSummary: ReturnType<typeof getDocumentsReviewSummaryFromDraft>
  selectedSubMerchantId: string
  isSubMerchantChanged: boolean
  setSelectedSubMerchantId: (subMerchantId: string) => void
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
  const initialSubMerchantId = caseDetail.documentReview?.subMerchantId ?? ''
  const [selectedSubMerchantId, setSelectedSubMerchantId] =
    useState(initialSubMerchantId)

  useEffect(() => {
    startTransition(() => {
      setDraftReviews(createDocumentsReviewDraft(caseDetail.fieldReviews))
    })
  }, [caseDetail.fieldReviews])

  useEffect(() => {
    startTransition(() => {
      setSelectedSubMerchantId(initialSubMerchantId)
    })
  }, [initialSubMerchantId])

  const value = useMemo<DocumentsReviewDraftContextValue>(
    () => ({
      draftReviews,
      reviewSummary: getDocumentsReviewSummaryFromDraft(
        caseDetail,
        draftReviews,
      ),
      selectedSubMerchantId,
      isSubMerchantChanged: selectedSubMerchantId !== initialSubMerchantId,
      setSelectedSubMerchantId,
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
    }),
    [caseDetail, draftReviews, initialSubMerchantId, selectedSubMerchantId],
  )

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
