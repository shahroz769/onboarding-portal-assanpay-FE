import { apiClient } from '#/lib/api-client'
import type {
  CaseComment,
  CaseDetail,
  CaseFilters,
  CaseHistory,
  CaseListResponse,
  CaseOwner,
  CaseStatus,
  CloseUnsuccessfulInput,
  CreateCommentInput,
  Queue,
  SaveFieldReviewsInput,
  SaveMidCreationDetailsInput,
  SaveMidCreationDetailsResponse,
  SaveDocumentReviewSubMerchantInput,
  SaveWordpressWebsiteInput,
  SendLiveEmailInput,
  SendMidCreationEmailInput,
  EmailRecipientSelection,
  EmailRecipientType,
  SelectSubMerchantFormInput,
  AgreementEmailResponse,
  MidCreationEmailResponse,
} from '#/schemas/cases.schema'

// ─── List Cases ─────────────────────────────────────────────────────────────

interface FetchCasesParams extends CaseFilters {
  cursor?: string | null
  limit?: number
}

export async function fetchCases(
  params: FetchCasesParams,
): Promise<CaseListResponse> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query[key] = String(value)
    }
  }

  const response = await apiClient.get<CaseListResponse>('/api/cases', {
    params: query,
  })
  return response.data
}

// ─── Create Case ────────────────────────────────────────────────────────────

interface CreateCaseParams {
  merchantId: string
  queueId: string
  subMerchantId?: string
}

export async function createCase(params: CreateCaseParams) {
  const response = await apiClient.post('/api/cases', params)
  return response.data
}

// ─── Update Case Status ─────────────────────────────────────────────────────

interface UpdateCaseStatusParams {
  caseId: string
  status: CaseStatus
}

export async function updateCaseStatus({
  caseId,
  status,
}: UpdateCaseStatusParams) {
  const response = await apiClient.patch(`/api/cases/${caseId}/status`, {
    status,
  })
  return response.data
}

// ─── Assign Case ────────────────────────────────────────────────────────────

interface AssignCaseParams {
  caseId: string
  ownerId: string | null
}

export async function assignCase({ caseId, ownerId }: AssignCaseParams) {
  const response = await apiClient.patch(`/api/cases/${caseId}/assign`, {
    ownerId,
  })
  return response.data
}

// ─── Fetch Queues ───────────────────────────────────────────────────────────

export async function fetchQueues(
  options: { includeInactive?: boolean } = {},
): Promise<Queue[]> {
  const response = await apiClient.get<Queue[]>('/api/queues', {
    params: options.includeInactive ? { includeInactive: 'true' } : undefined,
  })
  return response.data
}

// ─── Fetch Case Owners ──────────────────────────────────────────────────────

export async function fetchCaseOwners(): Promise<CaseOwner[]> {
  const response = await apiClient.get<CaseOwner[]>('/api/cases/owners')
  return response.data
}

// ─── Bulk Assign Cases ──────────────────────────────────────────────────────

export async function bulkAssignCases(ids: string[], ownerId: string | null) {
  const response = await apiClient.post('/api/cases/bulk-assign', {
    ids,
    ownerId,
  })
  return response.data
}

// ─── Update Case Priority ────────────────────────────────────────────────────

export async function updateCasePriority({
  caseId,
  priority,
}: {
  caseId: string
  priority: 'normal' | 'high'
}) {
  const response = await apiClient.patch(`/api/cases/${caseId}/priority`, {
    priority,
  })
  return response.data
}

// ─── Get Case Detail ────────────────────────────────────────────────────────

export async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  const response = await apiClient.get<CaseDetail>(`/api/cases/${caseId}`)
  return response.data
}

// ─── Take Ownership ─────────────────────────────────────────────────────────

export async function takeOwnership(caseId: string) {
  const response = await apiClient.patch(`/api/cases/${caseId}/take-ownership`)
  return response.data
}

// ─── Advance Stage ──────────────────────────────────────────────────────────

export async function advanceStage(caseId: string) {
  const response = await apiClient.patch(`/api/cases/${caseId}/advance-stage`)
  return response.data
}

// ─── Save Field Reviews ─────────────────────────────────────────────────────

export async function saveFieldReviews(
  caseId: string,
  input: SaveFieldReviewsInput,
) {
  const response = await apiClient.put(
    `/api/cases/${caseId}/field-reviews`,
    input,
  )
  return response.data
}

export async function saveDocumentReviewSubMerchant(
  caseId: string,
  input: SaveDocumentReviewSubMerchantInput,
) {
  const response = await apiClient.put(
    `/api/cases/${caseId}/document-review/sub-merchant`,
    input,
  )
  return response.data
}

// ─── Close Unsuccessful ─────────────────────────────────────────────────────

export async function closeUnsuccessful(
  caseId: string,
  input: CloseUnsuccessfulInput,
) {
  const response = await apiClient.patch(
    `/api/cases/${caseId}/close-unsuccessful`,
    input,
  )
  return response.data
}

// ─── Send For Resubmission ──────────────────────────────────────────────────

export interface SendForResubmissionResponse {
  status: 'sent' | 'failed'
  tokenExpiresAt: string | null
  emailLogId: string
  error?: string
}

export async function sendForResubmission(
  caseId: string,
  input: EmailRecipientSelection,
): Promise<SendForResubmissionResponse> {
  const response = await apiClient.post<SendForResubmissionResponse>(
    `/api/cases/${caseId}/send-for-resubmission`,
    input,
  )
  return response.data
}

// ─── EP Sub-Merchant Form ───────────────────────────────────────────────────

export async function selectSubMerchantForm(
  caseId: string,
  input: SelectSubMerchantFormInput,
) {
  const response = await apiClient.put(
    `/api/cases/${caseId}/sub-merchant-form/selection`,
    input,
  )
  return response.data
}

export async function uploadSubMerchantFinalForm({
  caseId,
  file,
  subMerchantKey,
}: {
  caseId: string
  file: File
  subMerchantKey: string
}) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('subMerchantKey', subMerchantKey)

  const response = await apiClient.post(
    `/api/cases/${caseId}/sub-merchant-form/final-form`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return response.data
}

export async function uploadSubMerchantEmailProof({
  caseId,
  file,
}: {
  caseId: string
  file: File
}) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post(
    `/api/cases/${caseId}/sub-merchant-form/email-proof`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return response.data
}

export async function uploadAgreementFinalAgreement({
  caseId,
  file,
}: {
  caseId: string
  file: File
}) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post(
    `/api/cases/${caseId}/agreement/final-agreement`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return response.data
}

export async function uploadPhysicalAgreementCopy({
  caseId,
  file,
}: {
  caseId: string
  file: File
}) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post(
    `/api/cases/${caseId}/physical-agreement/scanned-copy`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return response.data
}

export async function sendAgreementEmail(
  caseId: string,
  input: { remarks?: string | null } & EmailRecipientSelection,
): Promise<AgreementEmailResponse> {
  const response = await apiClient.post<AgreementEmailResponse>(
    `/api/cases/${caseId}/agreement/send-mail`,
    input,
  )
  return response.data
}

export async function sendMidCreationEmail(
  caseId: string,
  input: SendMidCreationEmailInput,
): Promise<MidCreationEmailResponse> {
  const response = await apiClient.post<MidCreationEmailResponse>(
    `/api/cases/${caseId}/testing/send-credentials-mail`,
    input,
  )
  return response.data
}

export async function sendLiveEmail(
  caseId: string,
  input: SendLiveEmailInput,
): Promise<MidCreationEmailResponse> {
  const response = await apiClient.post<MidCreationEmailResponse>(
    `/api/cases/${caseId}/live/send-mail`,
    input,
  )
  return response.data
}

// ─── Email preview & manual confirm ─────────────────────────────────────────

export interface EmailPreviewResult {
  recipient: string
  subject: string
  body: string
  tokenId: string
  tokenExpiresAt?: string
  goLiveAvailableAt?: string
}

export interface ManualEmailConfirmResult {
  status: 'sent'
  fileId: string
}

export type ManualCommunicationChannel = 'email' | 'whatsapp'

export async function fetchResubmissionEmailPreview(
  caseId: string,
  input: EmailRecipientSelection,
): Promise<EmailPreviewResult> {
  const response = await apiClient.post<EmailPreviewResult>(
    `/api/cases/${caseId}/send-for-resubmission/preview`,
    input,
  )
  return response.data
}

export async function confirmResubmissionEmailManual({
  caseId,
  tokenId,
  file,
  channel,
  recipientEmailType,
}: {
  caseId: string
  tokenId: string
  file: File
  channel?: ManualCommunicationChannel
  recipientEmailType: EmailRecipientType
}): Promise<ManualEmailConfirmResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('tokenId', tokenId)
  if (channel) formData.append('channel', channel)
  formData.append('recipientEmailType', recipientEmailType)
  const response = await apiClient.post<ManualEmailConfirmResult>(
    `/api/cases/${caseId}/send-for-resubmission/manual`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}

export async function fetchAgreementEmailPreview(
  caseId: string,
  input: { remarks?: string | null } & EmailRecipientSelection,
): Promise<EmailPreviewResult> {
  const response = await apiClient.post<EmailPreviewResult>(
    `/api/cases/${caseId}/agreement/send-mail/preview`,
    input,
  )
  return response.data
}

export async function confirmAgreementEmailManual({
  caseId,
  tokenId,
  remarks,
  file,
  channel,
  recipientEmailType,
}: {
  caseId: string
  tokenId: string
  remarks?: string | null
  file: File
  channel?: ManualCommunicationChannel
  recipientEmailType: EmailRecipientType
}): Promise<ManualEmailConfirmResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('tokenId', tokenId)
  if (remarks) formData.append('remarks', remarks)
  if (channel) formData.append('channel', channel)
  formData.append('recipientEmailType', recipientEmailType)
  const response = await apiClient.post<ManualEmailConfirmResult>(
    `/api/cases/${caseId}/agreement/send-mail/manual`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}

export async function fetchMidCreationEmailPreview(
  caseId: string,
  input: SendMidCreationEmailInput,
): Promise<EmailPreviewResult> {
  const response = await apiClient.post<EmailPreviewResult>(
    `/api/cases/${caseId}/testing/send-credentials-mail/preview`,
    input,
  )
  return response.data
}

export async function confirmMidCreationEmailManual({
  caseId,
  tokenId,
  file,
  channel,
  recipientEmailType,
}: {
  caseId: string
  tokenId: string
  file: File
  channel?: ManualCommunicationChannel
  recipientEmailType: EmailRecipientType
} & SendMidCreationEmailInput): Promise<ManualEmailConfirmResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('tokenId', tokenId)
  if (channel) formData.append('channel', channel)
  formData.append('recipientEmailType', recipientEmailType)
  const response = await apiClient.post<ManualEmailConfirmResult>(
    `/api/cases/${caseId}/testing/send-credentials-mail/manual`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}

export async function fetchLiveEmailPreview(
  caseId: string,
  input: SendLiveEmailInput,
): Promise<EmailPreviewResult> {
  const response = await apiClient.post<EmailPreviewResult>(
    `/api/cases/${caseId}/live/send-mail/preview`,
    input,
  )
  return response.data
}

export async function confirmLiveEmailManual({
  caseId,
  tokenId,
  file,
  ...input
}: {
  caseId: string
  tokenId: string
  file: File
  channel?: ManualCommunicationChannel
} & SendLiveEmailInput): Promise<ManualEmailConfirmResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('tokenId', tokenId)
  if (input.channel) formData.append('channel', input.channel)
  formData.append('recipientEmailType', input.recipientEmailType)
  const response = await apiClient.post<ManualEmailConfirmResult>(
    `/api/cases/${caseId}/live/send-mail/manual`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}

export async function saveMidCreationDetails(
  caseId: string,
  input: SaveMidCreationDetailsInput,
): Promise<SaveMidCreationDetailsResponse> {
  const response = await apiClient.post<SaveMidCreationDetailsResponse>(
    `/api/cases/${caseId}/mid-creation/save`,
    input,
  )
  return response.data
}

// ─── Case Comments ──────────────────────────────────────────────────────────

export async function markTestingLimitsApplied(caseId: string) {
  const response = await apiClient.post(
    `/api/cases/${caseId}/testing/limits-applied`,
    { applied: true },
  )
  return response.data
}

export async function markLiveLimitsApplied(caseId: string) {
  const response = await apiClient.post(
    `/api/cases/${caseId}/live/limits-applied`,
    { applied: true },
  )
  return response.data
}

export async function saveWordpressWebsiteCase({
  caseId,
  clonedWebsiteLink,
  screenshots,
  subMerchantLogoScreenshots,
  assanpayCheckoutScreenshots,
}: {
  caseId: string
  clonedWebsiteLink: SaveWordpressWebsiteInput['clonedWebsiteLink']
  screenshots: File[]
  subMerchantLogoScreenshots: Array<{
    subMerchantId: string
    file: File
  }>
  assanpayCheckoutScreenshots: File[]
}) {
  const formData = new FormData()
  formData.append('clonedWebsiteLink', clonedWebsiteLink)
  for (const screenshot of screenshots) {
    formData.append('screenshots', screenshot)
  }
  for (const screenshot of subMerchantLogoScreenshots) {
    formData.append(
      'subMerchantLogoScreenshotSubMerchantIds',
      screenshot.subMerchantId,
    )
    formData.append('subMerchantLogoScreenshots', screenshot.file)
  }
  for (const screenshot of assanpayCheckoutScreenshots) {
    formData.append('assanpayCheckoutScreenshots', screenshot)
  }

  const response = await apiClient.post(
    `/api/cases/${caseId}/wordpress-website`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return response.data
}

export async function fetchCaseComments(
  caseId: string,
): Promise<CaseComment[]> {
  const response = await apiClient.get<CaseComment[]>(
    `/api/cases/${caseId}/comments`,
  )
  return response.data
}

export async function createCaseComment(
  caseId: string,
  input: CreateCommentInput,
) {
  const response = await apiClient.post(`/api/cases/${caseId}/comments`, input)
  return response.data
}

// ─── Case History ───────────────────────────────────────────────────────────

export async function fetchCaseHistory(caseId: string): Promise<CaseHistory[]> {
  const response = await apiClient.get<CaseHistory[]>(
    `/api/cases/${caseId}/history`,
  )
  return response.data
}
