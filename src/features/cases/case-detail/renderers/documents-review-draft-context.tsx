import {
  createContext,
  startTransition,
  useContext,
  useEffect,
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
  selectedSubMerchantIds: string[]
  isSubMerchantChanged: boolean
  setSelectedSubMerchantIds: (subMerchantIds: string[]) => void
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
  const initialSubMerchants = caseDetail.documentReview?.subMerchants
  const initialSubMerchantIds =
    initialSubMerchants?.map((item) => item.id) ?? []

  const [selectedSubMerchantIds, setSelectedSubMerchantIds] = useState(
    initialSubMerchantIds,
  )

  useEffect(() => {
    startTransition(() => {
      setDraftReviews(createDocumentsReviewDraft(caseDetail.fieldReviews))
    })
  }, [caseDetail.fieldReviews])

  useEffect(() => {
    startTransition(() => {
      setSelectedSubMerchantIds(
        initialSubMerchants?.map((item) => item.id) ?? [],
      )
    })
  }, [initialSubMerchants])

  const value: DocumentsReviewDraftContextValue = {
    draftReviews,
    reviewSummary: getDocumentsReviewSummaryFromDraft(caseDetail, draftReviews),
    selectedSubMerchantIds,
    isSubMerchantChanged:
      [...selectedSubMerchantIds].sort().join(',') !==
      [...initialSubMerchantIds].sort().join(','),
    setSelectedSubMerchantIds,
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
  }

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
