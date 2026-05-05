import { queryOptions, useMutation } from '@tanstack/react-query'

import { apiClient } from '#/lib/api-client'

export type MerchantDocument = {
  id: string
  documentType: string
  originalName: string
  mimeType: string
  sizeBytes: number
  googleDriveFileId: string
  googleDriveWebViewLink: string
  googleDriveDownloadLink: string | null
  googleDriveFolderId: string
  status: string
  createdAt: string
  updatedAt: string
}

export type MerchantSubmissionResponse = {
  merchant: {
    id: string
    submitterEmail: string
    ownerFullName: string
    ownerPhone: string
    businessName: string
    businessPhone: string
    businessEmail: string
    businessAddress: string
    businessWebsite: string
    websiteCms: string
    businessDescription: string
    businessRegistrationDate: string
    businessNature: string
    merchantType: string
    estimatedMonthlyTransactions: number
    estimatedMonthlyVolume: string
    accountTitle: string
    bankName: string
    branchName: string
    accountNumberIban: string
    swiftCode: string | null
    nextOfKinRelation: string
    status: string
    onboardingStage: string
    submittedAt: string
    createdAt: string
    updatedAt: string
  }
  documents: MerchantDocument[]
}

export async function submitMerchantOnboardingForm(
  formData: FormData,
): Promise<MerchantSubmissionResponse> {
  const { data } = await apiClient.post<MerchantSubmissionResponse>(
    '/api/public/merchant-form',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )

  return data
}

export function useSubmitMerchantOnboardingMutation() {
  return useMutation({
    mutationKey: ['merchant-onboarding', 'submit'],
    mutationFn: submitMerchantOnboardingForm,
    retry: false,
  })
}

// ─── Resubmission ────────────────────────────────────────────────────────────

export type ResubmissionRejection = {
  fieldName: string
  label: string
  remarks: string | null
  isDocument: boolean
  isRequired?: boolean
  currentValue?: string
  currentDocumentName?: string
  currentDocumentUrl?: string
  documentType?: string
}

export type ResubmissionContext = {
  caseId: string
  caseNumber: string
  expiresAt: string
  merchantName: string
  merchantId: string
  ownerId: string | null
  merchantOwnerName: string
  rejections: Array<ResubmissionRejection>
}

export async function fetchResubmissionContext(
  token: string,
): Promise<ResubmissionContext> {
  const { data } = await apiClient.get<ResubmissionContext>(
    `/api/public/resubmission/${token}`,
  )
  return data
}

export function resubmissionContextQueryOptions(token: string) {
  return queryOptions({
    queryKey: ['resubmission-context', token] as const,
    queryFn: () => fetchResubmissionContext(token),
    enabled: Boolean(token),
    staleTime: 0,
    retry: false,
  })
}

export type ResubmissionResponse = {
  success: true
  caseNumber: string
}

export async function submitResubmission(
  token: string,
  formData: FormData,
): Promise<ResubmissionResponse> {
  const { data } = await apiClient.post<ResubmissionResponse>(
    `/api/public/resubmission/${token}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return data
}

export function useSubmitResubmissionMutation(token: string) {
  return useMutation({
    mutationKey: ['resubmission', 'submit', token] as const,
    mutationFn: (formData: FormData) => submitResubmission(token, formData),
    retry: false,
  })
}

// ─── Agreement Upload ───────────────────────────────────────────────────────

export type AgreementUploadContext = {
  caseId: string
  caseNumber: string
  expiresAt: string
  merchantName: string
  ownerName: string
  finalAgreementName: string
  finalAgreementUrl: string
  remarks: string | null
}

export async function fetchAgreementUploadContext(
  token: string,
): Promise<AgreementUploadContext> {
  const { data } = await apiClient.get<AgreementUploadContext>(
    `/api/public/agreement/${token}`,
  )
  return data
}

export function agreementUploadContextQueryOptions(token: string) {
  return queryOptions({
    queryKey: ['agreement-upload-context', token] as const,
    queryFn: () => fetchAgreementUploadContext(token),
    enabled: Boolean(token),
    staleTime: 0,
    retry: false,
  })
}

export type AgreementUploadResponse = {
  success: true
  caseNumber: string
}

export async function submitAgreementUpload(
  token: string,
  file: File,
): Promise<AgreementUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post<AgreementUploadResponse>(
    `/api/public/agreement/${token}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return data
}

export function useSubmitAgreementUploadMutation(token: string) {
  return useMutation({
    mutationKey: ['agreement-upload', 'submit', token] as const,
    mutationFn: (file: File) => submitAgreementUpload(token, file),
    retry: false,
  })
}

// MID Go-Live

export type MidGoLiveContext = {
  status: 'not_ready' | 'ready' | 'started'
  caseNumber: string
  merchantName: string
  availableAt: string
  liveCaseNumber: string | null
}

export async function fetchMidGoLiveContext(
  token: string,
): Promise<MidGoLiveContext> {
  const { data } = await apiClient.get<MidGoLiveContext>(
    `/api/public/mid-go-live/${token}`,
  )
  return data
}

export function midGoLiveContextQueryOptions(token: string) {
  return queryOptions({
    queryKey: ['mid-go-live-context', token] as const,
    queryFn: () => fetchMidGoLiveContext(token),
    enabled: Boolean(token),
    staleTime: 0,
    retry: false,
  })
}

export type MidGoLiveActivationResponse = {
  success: true
  alreadyStarted: boolean
  caseNumber: string
  liveCaseId: string | null
  liveCaseNumber: string | null
}

export async function activateMidGoLive(
  token: string,
): Promise<MidGoLiveActivationResponse> {
  const { data } = await apiClient.post<MidGoLiveActivationResponse>(
    `/api/public/mid-go-live/${token}`,
  )
  return data
}

export function useActivateMidGoLiveMutation(token: string) {
  return useMutation({
    mutationKey: ['mid-go-live', 'activate', token] as const,
    mutationFn: () => activateMidGoLive(token),
    retry: false,
  })
}
