import * as z from 'zod'

// ── Enum Constants ──────────────────────────────────────────────────────────

export const WEBSITE_CMS_OPTIONS = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'custom_website', label: 'Custom Website' },
] as const

export const MERCHANT_TYPES = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  {
    value: 'private_limited_company',
    label: 'Private Limited Company / SMC Private Limited',
  },
  { value: 'public_limited_company', label: 'Public Limited Company' },
  { value: 'partnership', label: 'Partnership' },
  {
    value: 'limited_liability_partnership',
    label: 'Limited Liability Partnership',
  },
  { value: 'ngo_npo_charity', label: 'NGO / NPO / Charity' },
  {
    value: 'trust_society_association',
    label: 'Trust / Society / Association',
  },
] as const

export const KIN_RELATIONS = [
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
] as const

export const BANK_NAMES = [
  'Al Baraka Islamic Bank Limited',
  'Bank AlFalah Limited',
  'Bank Al Habib',
  'Allied Bank Limited',
  'Askari Commercial Bank Limited',
  'Bank of Khyber',
  'Bank Islami Pakistan Limited',
  'Burj Bank Limited',
  'Citi Bank',
  'Dubai Islamic Bank Pakistan Limited',
  'Faysal Bank Limited',
  'Habib Bank Limited',
  'Habib Metropolitan Bank',
  'JS Bank',
  'KASB Bank',
  'MCB Bank Limited',
  'MCB Islamic Bank',
  'Meezan Bank',
  'National Bank of Pakistan',
  'NIB Bank',
  'Standard Chartered Bank',
  'Samba Bank',
  'Silkbank',
  'Sindh Bank',
  'Soneri Bank Limited',
  'Summit Bank',
  'United Bank Limited',
] as const

// ── Zod Enum Tuples ─────────────────────────────────────────────────────────

const websiteCmsValues = WEBSITE_CMS_OPTIONS.map((o) => o.value) as [
  string,
  ...string[],
]
const merchantTypeValues = MERCHANT_TYPES.map((o) => o.value) as [
  string,
  ...string[],
]
const kinRelationValues = KIN_RELATIONS.map((o) => o.value) as [
  string,
  ...string[],
]
const bankNameValues = BANK_NAMES as unknown as [string, ...string[]]
export const localMobileNumberSchema = z
  .string()
  .trim()
  .regex(/^03\d{9}$/, 'Must be a valid mobile number.')
export const digitsOnlyPhoneNumberSchema = z
  .string()
  .trim()
  .min(1, 'Business phone number is required.')
  .max(32, 'Business phone number must be 32 digits or fewer.')
  .regex(/^\d+$/, 'Business phone number must contain numbers only.')

// The API enforces these same rules; here they only give earlier feedback.
function boundedText(label: string, maxLength: number) {
  return z
    .string()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`)
}

function isReservedDomain(domain: string) {
  const normalized = domain.toLowerCase().replace(/\.$/, '')
  return (
    /(^|\.)example\.(com|net|org)$/.test(normalized) ||
    /\.(example|test|invalid|localhost)$/.test(normalized)
  )
}

function realEmail(label: string) {
  return z
    .string()
    .min(1, `${label} is required.`)
    .max(255, 'Email must be 255 characters or fewer.')
    .pipe(z.email('Must be a valid email address.'))
    .refine(
      (value) => !isReservedDomain(value.split('@')[1] ?? ''),
      'Please use a real email address.',
    )
}

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

// ── Form Schema ─────────────────────────────────────────────────────────────

export const merchantOnboardingSchema = z.object({
  // Section 1: Submitter
  email: realEmail('Submitter email'),
  activeWhatsappNumber: localMobileNumberSchema,

  // Section 2: Owner
  ownerFullName: boundedText('Owner full name', 160),
  ownerPhone: localMobileNumberSchema,

  // Section 3: Business Information
  businessName: boundedText('Business name', 200),
  businessPhone: digitsOnlyPhoneNumberSchema,
  businessEmail: realEmail('Business email'),
  businessAddress: boundedText('Business address', 1000),
  businessWebsite: z
    .string()
    .min(1, 'Business website is required.')
    .max(500, 'Business website must be 500 characters or fewer.')
    .pipe(z.url('Must be a valid URL (include https://).'))
    .refine(isHttpUrl, 'Must start with http:// or https://.'),
  websiteCms: z.enum(websiteCmsValues, 'Please select a website platform.'),
  businessDescription: boundedText('Business description', 5000),
  businessRegistrationDate: z
    .string()
    .min(1, 'Business registration date is required.')
    .refine((val) => {
      const date = new Date(val)
      return !isNaN(date.getTime()) && date <= new Date()
    }, 'Registration date cannot be in the future.'),
  businessNature: boundedText('Nature of business', 160),

  // Section 4: Business Classification
  merchantType: z.enum(merchantTypeValues, 'Please select a business type.'),
  estimatedMonthlyTransactions: z
    .string()
    .min(1, 'Estimated monthly transactions is required.')
    .refine((val) => {
      const num = Number(val)
      return Number.isInteger(num) && num > 0 && num <= 2_147_483_647
    }, 'Must be a whole number greater than 0.'),
  estimatedMonthlyVolume: z
    .string()
    .min(1, 'Estimated monthly volume is required.')
    .refine((val) => {
      const num = Number(val)
      return !isNaN(num) && num > 0 && num <= 999_999_999_999.99
    }, 'Must be a number greater than 0.'),

  // Section 5: Financial Information
  accountTitle: boundedText('Account title', 200),
  bankName: z.enum(bankNameValues, 'Please select a bank.'),
  branchName: boundedText('Branch name', 160),
  accountNumberIban: boundedText('Account number / IBAN', 64),
  swiftCode: z.string().max(64, 'SWIFT code must be 64 characters or fewer.'),

  // Section 6: Next of Kin
  nextOfKinRelation: z.enum(kinRelationValues, 'Please select a relation.'),
})

export type MerchantOnboardingFormValues = z.infer<
  typeof merchantOnboardingSchema
>

// ── Document Configuration ──────────────────────────────────────────────────

export type DocumentFieldName =
  | 'owner_cnic_front'
  | 'owner_cnic_back'
  | 'next_of_kin_cnic_front'
  | 'next_of_kin_cnic_back'
  | 'utility_bill'
  | 'company_ntn'
  | 'authority_letter'
  | 'taxpayer_registration_certificate'
  | 'company_incorporation_certificate'
  | 'memorandum_articles'
  | 'form_ii'
  | 'form_a'
  | 'board_resolution'
  | 'certificate_of_commencement'
  | 'partnership_deed'
  | 'form_c'
  | 'llp_form_iii'
  | 'annual_audited_accounts'
  | 'other_entity_certification'
  | 'secp_section_42_license'
  | 'risk_assessment_documents'
  | 'by_laws_rules_regulations'
  | 'trust_deed'
  | 'trust_registration_certificate'
  | 'trustees_authorized_signatories_cnic'
  | 'proof_of_address'
  | 'tax_exemption_certificate'
  | 'other_supporting_documents'

export const DOCUMENT_LABELS: Record<DocumentFieldName, string> = {
  owner_cnic_front: 'Owner CNIC Front',
  owner_cnic_back: 'Owner CNIC Back',
  next_of_kin_cnic_front: 'Next Of Kin CNIC Front',
  next_of_kin_cnic_back: 'Next Of Kin CNIC Back',
  utility_bill: 'Utility Bill',
  company_ntn: 'NTN Certificate',
  authority_letter: 'Authority Letter',
  taxpayer_registration_certificate: 'Taxpayer Registration Certificate',
  company_incorporation_certificate: 'Company Incorporation Certificate',
  memorandum_articles: 'Memorandum & Articles',
  form_ii: 'Form II',
  form_a: 'Form 1 / Form A',
  board_resolution: 'Board Resolution / Authorization Letter',
  certificate_of_commencement: 'Certificate Of Commencement',
  partnership_deed: 'Partnership Deed',
  form_c: 'Form C',
  llp_form_iii: 'LLP Form III',
  annual_audited_accounts: 'Annual Audited Accounts Report',
  other_entity_certification: 'Other Entity Certification',
  secp_section_42_license: 'SECP Section 42 License',
  risk_assessment_documents: 'Risk Assessment Documents',
  by_laws_rules_regulations: 'By Laws / Rules / Regulations',
  trust_deed: 'Trust Deed',
  trust_registration_certificate: 'Trust Registration Certificate',
  trustees_authorized_signatories_cnic:
    'CNIC of Trustees / Authorized Signatories',
  proof_of_address: 'Proof of Address',
  tax_exemption_certificate: 'Tax Exemption Certificate',
  other_supporting_documents: 'Other Supporting Documents',
}

export const BASE_DOCUMENTS: DocumentFieldName[] = [
  'owner_cnic_front',
  'owner_cnic_back',
  'next_of_kin_cnic_front',
  'next_of_kin_cnic_back',
  'utility_bill',
]

type MerchantTypeKey = (typeof MERCHANT_TYPES)[number]['value']

export const MERCHANT_SPECIFIC_DOCUMENTS: Record<
  MerchantTypeKey,
  { required: DocumentFieldName[]; optional: DocumentFieldName[] }
> = {
  sole_proprietorship: {
    required: ['company_ntn'],
    optional: ['authority_letter', 'taxpayer_registration_certificate'],
  },
  private_limited_company: {
    required: ['company_ntn', 'company_incorporation_certificate', 'form_a'],
    optional: [
      'memorandum_articles',
      'form_ii',
      'board_resolution',
      'certificate_of_commencement',
    ],
  },
  public_limited_company: {
    required: ['company_ntn', 'company_incorporation_certificate'],
    optional: [
      'memorandum_articles',
      'form_ii',
      'form_a',
      'board_resolution',
      'certificate_of_commencement',
    ],
  },
  partnership: {
    required: ['company_ntn'],
    optional: ['authority_letter', 'partnership_deed', 'form_c'],
  },
  limited_liability_partnership: {
    required: ['company_ntn', 'company_incorporation_certificate'],
    optional: ['authority_letter', 'partnership_deed', 'llp_form_iii'],
  },
  ngo_npo_charity: {
    required: ['company_ntn', 'company_incorporation_certificate'],
    optional: [
      'memorandum_articles',
      'form_ii',
      'form_a',
      'board_resolution',
      'annual_audited_accounts',
      'other_entity_certification',
      'secp_section_42_license',
      'risk_assessment_documents',
      'by_laws_rules_regulations',
    ],
  },
  trust_society_association: {
    required: [
      'company_ntn',
      'board_resolution',
      'annual_audited_accounts',
      'trust_deed',
      'trust_registration_certificate',
      'trustees_authorized_signatories_cnic',
      'proof_of_address',
    ],
    optional: ['tax_exemption_certificate', 'other_supporting_documents'],
  },
}

// ── File Validation ─────────────────────────────────────────────────────────

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]
export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp']
export const MIN_FILE_SIZE_BYTES = 500
export const MAX_FILE_NAME_LENGTH = 255
