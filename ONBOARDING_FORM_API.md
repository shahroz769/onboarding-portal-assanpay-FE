# Merchant Onboarding Form API

This document describes how to build an external frontend form that submits a merchant onboarding application to the AssanPay onboarding backend.

## Endpoint

```txt
POST {BACKEND_BASE_URL}/api/public/merchant-form
```

Example local backend URL:

```txt
http://localhost:3000/api/public/merchant-form
```

This endpoint is public. It does not require an access token or login session.

## CORS Requirement

If the form is submitted from a browser on another website, that website origin must be allowed by the backend `CORS_ORIGIN` environment variable.

Example:

```txt
CORS_ORIGIN=https://your-form-website.com,https://www.your-form-website.com
```

Without this backend CORS configuration, browser submissions from the external site will be blocked before reaching the API.

## Request Format

The request must be `multipart/form-data` because document files are required.

Do not submit JSON.

When using browser `fetch`, do not manually set the `Content-Type` header. The browser will add the required multipart boundary automatically.

```ts
const formData = new FormData()
formData.append('email', values.email)
formData.append('activeWhatsappNumber', values.activeWhatsappNumber)
// append all other text fields...
formData.append('owner_cnic_front', ownerCnicFrontFile)

const response = await fetch(`${BACKEND_BASE_URL}/api/public/merchant-form`, {
  method: 'POST',
  body: formData,
})

const data = await response.json()
if (!response.ok) {
  throw new Error(data.error ?? 'Submission failed')
}
```

## Text Fields

All text fields below are required unless marked optional. Field names are case-sensitive.

| Field name                     | Label                          | Validation                                                      |
| ------------------------------ | ------------------------------ | --------------------------------------------------------------- |
| `email`                        | Submitter Email                | Valid email address                                             |
| `activeWhatsappNumber`         | Active WhatsApp Number         | Pakistani mobile number: `03XXXXXXXXX`, exactly 11 digits       |
| `ownerFullName`                | Full Name                      | Required text                                                   |
| `ownerPhone`                   | Phone Number                   | Pakistani mobile number: `03XXXXXXXXX`, exactly 11 digits       |
| `businessName`                 | Business Name                  | Required text                                                   |
| `businessPhone`                | Business Phone Number          | Digits only                                                     |
| `businessEmail`                | Business Email                 | Valid email address                                             |
| `businessAddress`              | Business Address               | Required text                                                   |
| `businessWebsite`              | Business Website               | Valid URL, include protocol such as `https://`                  |
| `websiteCms`                   | Website Platform / CMS         | One of the allowed website CMS values                           |
| `businessDescription`          | Business Description           | Required text                                                   |
| `businessRegistrationDate`     | Business Registration Date     | Valid date, not in the future. Recommended format: `YYYY-MM-DD` |
| `businessNature`               | Nature of Business             | Required text                                                   |
| `merchantType`                 | Business Type                  | One of the allowed merchant type values                         |
| `estimatedMonthlyTransactions` | Estimated Monthly Transactions | Whole number greater than `0`                                   |
| `estimatedMonthlyVolume`       | Estimated Monthly Volume (PKR) | Number greater than `0`                                         |
| `accountTitle`                 | Account Title                  | Required text                                                   |
| `bankName`                     | Bank Name                      | Must exactly match one of the allowed bank names                |
| `branchName`                   | Branch Name                    | Required text                                                   |
| `accountNumberIban`            | Account Number / IBAN          | Required text                                                   |
| `swiftCode`                    | SWIFT Code                     | Optional. Omit or send empty string if not applicable           |
| `nextOfKinRelation`            | Next of Kin Relation           | One of the allowed relation values                              |

The backend rejects unexpected fields and duplicate fields.

## Allowed Values

### `websiteCms`

| Value            | Label          |
| ---------------- | -------------- |
| `wordpress`      | WordPress      |
| `shopify`        | Shopify        |
| `custom_website` | Custom Website |

### `merchantType`

| Value                           | Label                         |
| ------------------------------- | ----------------------------- |
| `sole_proprietorship`           | Sole Proprietorship           |
| `private_limited_company`       | Private Limited Company       |
| `public_limited_company`        | Public Limited Company        |
| `partnership`                   | Partnership                   |
| `limited_liability_partnership` | Limited Liability Partnership |
| `ngo_npo_charity`               | NGO / NPO / Charity           |
| `trust_society_association`     | Trust / Society / Association |

### `nextOfKinRelation`

| Value      | Label    |
| ---------- | -------- |
| `mother`   | Mother   |
| `father`   | Father   |
| `brother`  | Brother  |
| `sister`   | Sister   |
| `wife`     | Wife     |
| `son`      | Son      |
| `daughter` | Daughter |

### `bankName`

The submitted bank name must exactly match one of these strings:

```txt
Advans Microfinance Bank
Al Baraka Islamic Bank Limited
Bank AlFalah Limited
Allied Bank Limited
Apna Microfinance Bank
Askari Commercial Bank Limited
Bank of Khyber
Bank Islami Pakistan Limited
Burj Bank Limited
Citi Bank
Dubai Islamic Bank Pakistan Limited
FINCA
Finja
First Women Bank
Faysal Bank Limited
Habib Bank Limited
Habib Metropolitan Bank
ICBC
JS Bank
KASB Bank
MCB Bank Limited
MCB Arif Habib
MCB Islamic Bank
Meezan Bank
Mobilink Microfinance Bank
NayaPay
National Bank of Pakistan
NIB Bank
NRSP Bank Fori Cash
Paymax
Sadapay
Standard Chartered Bank
Samba Bank
Silkbank
Sindh Bank
Soneri Bank Limited
Summit Bank
TAG
United Bank Limited
Upaisa
ZTBL
EasyPaisa
JazzCash
```

## File Upload Rules

Each uploaded document must be appended to the same `FormData` using the document field name as the key.

Allowed file types:

```txt
PDF, JPG, JPEG, PNG, WEBP
```

Allowed MIME types:

```txt
application/pdf
image/jpeg
image/png
image/webp
```

Maximum file size:

```txt
10 MB per document
```

Only one file may be uploaded per document field. Empty files are ignored and will not satisfy required document validation.

## Required Documents

These documents are required for every submission:

| Field name               | Label                  |
| ------------------------ | ---------------------- |
| `owner_cnic_front`       | Owner CNIC Front       |
| `owner_cnic_back`        | Owner CNIC Back        |
| `next_of_kin_cnic_front` | Next Of Kin CNIC Front |
| `next_of_kin_cnic_back`  | Next Of Kin CNIC Back  |
| `utility_bill`           | Utility Bill           |

Additional required documents depend on `merchantType`.

### `sole_proprietorship`

Required:

```txt
company_ntn
```

Optional:

```txt
authority_letter
taxpayer_registration_certificate
```

### `private_limited_company`

Required:

```txt
company_ntn
company_incorporation_certificate
```

Optional:

```txt
memorandum_articles
form_ii
form_a
board_resolution
certificate_of_commencement
```

### `public_limited_company`

Required:

```txt
company_ntn
company_incorporation_certificate
```

Optional:

```txt
memorandum_articles
form_ii
form_a
board_resolution
certificate_of_commencement
```

### `partnership`

Required:

```txt
company_ntn
```

Optional:

```txt
authority_letter
partnership_deed
form_c
```

### `limited_liability_partnership`

Required:

```txt
company_ntn
company_incorporation_certificate
```

Optional:

```txt
authority_letter
partnership_deed
llp_form_iii
```

### `ngo_npo_charity`

Required:

```txt
company_ntn
company_incorporation_certificate
```

Optional:

```txt
memorandum_articles
form_ii
form_a
board_resolution
annual_audited_accounts
other_entity_certification
secp_section_42_license
risk_assessment_documents
by_laws_rules_regulations
```

### `trust_society_association`

Required:

```txt
company_ntn
```

Optional:

```txt
board_resolution
annual_audited_accounts
other_entity_certification
```

## All Document Field Labels

| Field name                          | Label                             |
| ----------------------------------- | --------------------------------- |
| `owner_cnic_front`                  | Owner CNIC Front                  |
| `owner_cnic_back`                   | Owner CNIC Back                   |
| `next_of_kin_cnic_front`            | Next Of Kin CNIC Front            |
| `next_of_kin_cnic_back`             | Next Of Kin CNIC Back             |
| `utility_bill`                      | Utility Bill                      |
| `company_ntn`                       | Company NTN                       |
| `authority_letter`                  | Authority Letter                  |
| `taxpayer_registration_certificate` | Taxpayer Registration Certificate |
| `company_incorporation_certificate` | Company Incorporation Certificate |
| `memorandum_articles`               | Memorandum & Articles             |
| `form_ii`                           | Form II                           |
| `form_a`                            | Form A                            |
| `board_resolution`                  | Board Resolution                  |
| `certificate_of_commencement`       | Certificate Of Commencement       |
| `partnership_deed`                  | Partnership Deed                  |
| `form_c`                            | Form C                            |
| `llp_form_iii`                      | LLP Form III                      |
| `annual_audited_accounts`           | Annual Audited Accounts           |
| `other_entity_certification`        | Other Entity Certification        |
| `secp_section_42_license`           | SECP Section 42 License           |
| `risk_assessment_documents`         | Risk Assessment Documents         |
| `by_laws_rules_regulations`         | By Laws / Rules / Regulations     |

## Example FormData Payload

This example is for `sole_proprietorship`.

```ts
async function submitOnboardingForm(
  values: {
    email: string
    activeWhatsappNumber: string
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
    estimatedMonthlyTransactions: string
    estimatedMonthlyVolume: string
    accountTitle: string
    bankName: string
    branchName: string
    accountNumberIban: string
    swiftCode?: string
    nextOfKinRelation: string
  },
  files: Record<string, File>,
) {
  const formData = new FormData()

  formData.append('email', values.email)
  formData.append('activeWhatsappNumber', values.activeWhatsappNumber)
  formData.append('ownerFullName', values.ownerFullName)
  formData.append('ownerPhone', values.ownerPhone)
  formData.append('businessName', values.businessName)
  formData.append('businessPhone', values.businessPhone)
  formData.append('businessEmail', values.businessEmail)
  formData.append('businessAddress', values.businessAddress)
  formData.append('businessWebsite', values.businessWebsite)
  formData.append('websiteCms', values.websiteCms)
  formData.append('businessDescription', values.businessDescription)
  formData.append('businessRegistrationDate', values.businessRegistrationDate)
  formData.append('businessNature', values.businessNature)
  formData.append('merchantType', values.merchantType)
  formData.append(
    'estimatedMonthlyTransactions',
    values.estimatedMonthlyTransactions,
  )
  formData.append('estimatedMonthlyVolume', values.estimatedMonthlyVolume)
  formData.append('accountTitle', values.accountTitle)
  formData.append('bankName', values.bankName)
  formData.append('branchName', values.branchName)
  formData.append('accountNumberIban', values.accountNumberIban)
  formData.append('swiftCode', values.swiftCode ?? '')
  formData.append('nextOfKinRelation', values.nextOfKinRelation)

  formData.append('owner_cnic_front', files.owner_cnic_front)
  formData.append('owner_cnic_back', files.owner_cnic_back)
  formData.append('next_of_kin_cnic_front', files.next_of_kin_cnic_front)
  formData.append('next_of_kin_cnic_back', files.next_of_kin_cnic_back)
  formData.append('utility_bill', files.utility_bill)
  formData.append('company_ntn', files.company_ntn)

  const response = await fetch(`${BACKEND_BASE_URL}/api/public/merchant-form`, {
    method: 'POST',
    body: formData,
  })

  const responseBody = await response.json()

  if (!response.ok) {
    throw new Error(responseBody.error ?? 'Unable to submit onboarding form.')
  }

  return responseBody
}
```

## Success Response

Status code:

```txt
201 Created
```

Response shape:

```ts
type MerchantSubmissionResponse = {
  merchant: {
    id: string
    submitterEmail: string
    ownerFullName: string
    ownerPhone: string
    activeWhatsappNumber: string | null
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
    status: 'pending' | 'testing' | 'live' | 'terminated'
    submittedAt: string
    createdAt: string
    updatedAt: string
  }
  documents: Array<{
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
  }>
}
```

## Error Responses

Error responses use this shape:

```json
{
  "error": "Error message here."
}
```

Common status codes:

| Status | Meaning                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Invalid payload, missing required field, missing required document, unexpected field, duplicate field, or invalid business type/document combination |
| `413`  | Uploaded file is larger than 10 MB                                                                                                                   |
| `415`  | Unsupported document file type                                                                                                                       |
| `500`  | Internal server error, including missing backend storage configuration                                                                               |
| `502`  | Google Drive upload or folder creation failure                                                                                                       |

Examples:

```json
{ "error": "Content-Type must be multipart/form-data." }
```

```json
{ "error": "Document \"utility_bill\" is required." }
```

```json
{ "error": "Document \"owner_cnic_front\" exceeds the 10 MB limit." }
```

## Frontend Implementation Checklist

- Use `multipart/form-data`.
- Send every required text field exactly once.
- Use the exact enum values listed in this document.
- Use the exact bank-name strings listed in this document.
- Validate `03XXXXXXXXX` mobile numbers client-side for `activeWhatsappNumber` and `ownerPhone`.
- Validate file type and size client-side before submit.
- Show required documents dynamically based on selected `merchantType`.
- Include `utility_bill` for every submission.
- Do not submit document fields that are not allowed for the selected `merchantType`.
- Ask the backend owner to add your website origin to `CORS_ORIGIN` before testing from the browser.
