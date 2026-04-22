import {
  BASE_DOCUMENTS,
  DOCUMENT_LABELS,
  MERCHANT_SPECIFIC_DOCUMENTS,
} from '#/schemas/merchant-onboarding.schema'
import type {
  CaseDetail,
  FieldReview,
  FieldReviewStatus,
  SaveFieldReviewsInput,
} from '#/schemas/cases.schema'

type ReviewFieldDefinition = {
  key: string
  label: string
}

export type DocumentsReviewableItem = {
  key: string
  label: string
}

export type DocumentsReviewDraft = {
  status: FieldReviewStatus
  remarks: string
}

export type DocumentsReviewDraftMap = Partial<
  Record<string, DocumentsReviewDraft>
>

export type DocumentsReviewSummary = {
  reviewables: DocumentsReviewableItem[]
  approvedItems: DocumentsReviewableItem[]
  rejectedItems: Array<DocumentsReviewableItem & { remarks: string | null }>
  pendingItems: DocumentsReviewableItem[]
  isFullyApproved: boolean
}

const REVIEW_FIELDS: ReviewFieldDefinition[] = [
  { key: 'submitterEmail', label: 'Submitter Email' },
  { key: 'ownerFullName', label: 'Owner Full Name' },
  { key: 'ownerPhone', label: 'Owner Phone Number' },
  { key: 'businessName', label: 'Business Name' },
  { key: 'businessPhone', label: 'Business Phone Number' },
  { key: 'businessEmail', label: 'Business Email' },
  { key: 'businessWebsite', label: 'Business Website' },
  { key: 'businessAddress', label: 'Business Address' },
  { key: 'websiteCms', label: 'Website Platform / CMS' },
  { key: 'businessRegistrationDate', label: 'Business Registration Date' },
  { key: 'businessDescription', label: 'Business Description' },
  { key: 'businessNature', label: 'Nature of Business' },
  { key: 'merchantType', label: 'Merchant Type' },
  { key: 'estimatedMonthlyTransactions', label: 'Estimated Monthly Transactions' },
  { key: 'estimatedMonthlyVolume', label: 'Estimated Monthly Volume (PKR)' },
  { key: 'accountTitle', label: 'Account Title' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'branchName', label: 'Branch Name' },
  { key: 'accountNumberIban', label: 'Account Number / IBAN' },
  { key: 'swiftCode', label: 'SWIFT Code' },
  { key: 'nextOfKinRelation', label: 'Next of Kin Relation' },
]

type MerchantDocument = {
  id: string
  originalName?: string | null
  googleDriveWebViewLink?: string | null
  documentType?: string | null
}

function formatDisplayValue(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function getDraftReviewByField(draftReviews: DocumentsReviewDraftMap) {
  return new Map(Object.entries(draftReviews))
}

export function createDocumentsReviewDraft(
  fieldReviews: FieldReview[],
): DocumentsReviewDraftMap {
  const draft: DocumentsReviewDraftMap = {}

  for (const review of fieldReviews) {
    draft[review.fieldName] = {
      status: review.status,
      remarks: review.remarks ?? '',
    }
  }

  return draft
}

export function getDocumentsReviewables(caseDetail: CaseDetail) {
  const merchantData = caseDetail.merchant as Record<string, unknown>
  const fieldItems = REVIEW_FIELDS
    .map<DocumentsReviewableItem | null>((field) => {
      const resolvedValue = formatDisplayValue(merchantData[field.key])

      if (!resolvedValue) return null

      return {
        key: field.key,
        label: field.label,
      }
    })
    .filter((item): item is DocumentsReviewableItem => item !== null)

  const merchantType = formatDisplayValue(merchantData.merchantType)
  const merchantSpecificDocs = merchantType
    ? MERCHANT_SPECIFIC_DOCUMENTS[
        merchantType as keyof typeof MERCHANT_SPECIFIC_DOCUMENTS
      ]
    : null
  const requiredDocs = new Set([
    ...BASE_DOCUMENTS,
    ...(merchantSpecificDocs?.required ?? []),
  ])

  const documentItems = caseDetail.documents
    .map<DocumentsReviewableItem | null>((rawDocument) => {
      const document = rawDocument as unknown as MerchantDocument
      const url = document.googleDriveWebViewLink?.trim()

      if (!url) return null

      const documentKey =
        document.documentType && document.documentType in DOCUMENT_LABELS
          ? document.documentType
          : null

      const label = documentKey
        ? DOCUMENT_LABELS[documentKey as keyof typeof DOCUMENT_LABELS]
        : document.documentType ?? document.originalName ?? 'Uploaded Document'

      return {
        key: `doc_${document.id}`,
        label: requiredDocs.has(documentKey as keyof typeof DOCUMENT_LABELS)
          ? label
          : label,
      }
    })
    .filter((item): item is DocumentsReviewableItem => item !== null)

  return [...fieldItems, ...documentItems]
}

export function getDocumentsReviewSummary(
  caseDetail: CaseDetail,
): DocumentsReviewSummary {
  return getDocumentsReviewSummaryFromDraft(
    caseDetail,
    createDocumentsReviewDraft(caseDetail.fieldReviews),
  )
}

export function getDocumentsReviewSummaryFromDraft(
  caseDetail: CaseDetail,
  draftReviews: DocumentsReviewDraftMap,
): DocumentsReviewSummary {
  const reviewables = getDocumentsReviewables(caseDetail)
  const reviewsByField = getDraftReviewByField(draftReviews)

  const approvedItems: DocumentsReviewableItem[] = []
  const rejectedItems: Array<DocumentsReviewableItem & { remarks: string | null }> = []
  const pendingItems: DocumentsReviewableItem[] = []

  for (const item of reviewables) {
    const review = reviewsByField.get(item.key)

    if (review?.status === 'approved') {
      approvedItems.push(item)
      continue
    }

    if (review?.status === 'rejected') {
      rejectedItems.push({
        ...item,
        remarks: review.remarks || null,
      })
      continue
    }

    pendingItems.push(item)
  }

  return {
    reviewables,
    approvedItems,
    rejectedItems,
    pendingItems,
    isFullyApproved:
      reviewables.length > 0 &&
      approvedItems.length === reviewables.length &&
      rejectedItems.length === 0,
  }
}

export function createApproveAllReviewsInput(
  caseDetail: CaseDetail,
): SaveFieldReviewsInput {
  return {
    reviews: getDocumentsReviewables(caseDetail).map((item) => ({
      fieldName: item.key,
      status: 'approved' as const,
    })),
  }
}

export function createSaveFieldReviewsInputFromDraft(
  draftReviews: DocumentsReviewDraftMap,
): SaveFieldReviewsInput {
  return {
    reviews: Object.entries(draftReviews).flatMap(([fieldName, review]) => {
      if (!review) {
        return []
      }

      const remarks = review.remarks.trim()

      return [{
        fieldName,
        status: review.status,
        ...(remarks ? { remarks } : {}),
      }]
    }),
  }
}
