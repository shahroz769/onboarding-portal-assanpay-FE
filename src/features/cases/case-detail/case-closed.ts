import type { CaseDetail } from '#/schemas/cases.schema'

/**
 * Whether the case is closed. The status is the source of truth; the stage
 * category and close fields cover a case whose stage is missing or a payload
 * that lags one of them.
 */
export function isCaseClosed(caseDetail: CaseDetail) {
  return (
    caseDetail.case.status === 'closed' ||
    caseDetail.currentStage?.category === 'closed' ||
    Boolean(caseDetail.case.closedAt) ||
    Boolean(caseDetail.case.closeOutcome)
  )
}
