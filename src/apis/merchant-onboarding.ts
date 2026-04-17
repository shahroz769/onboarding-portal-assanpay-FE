import { useMutation } from "@tanstack/react-query"

import { apiClient } from "#/lib/api-client"

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
  formData: FormData
): Promise<MerchantSubmissionResponse> {
  const { data } = await apiClient.post<MerchantSubmissionResponse>(
    "/api/public/merchant-form",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  )

  return data
}

export function useSubmitMerchantOnboardingMutation() {
  return useMutation({
    mutationKey: ["merchant-onboarding", "submit"],
    mutationFn: submitMerchantOnboardingForm,
    retry: false,
  })
}
