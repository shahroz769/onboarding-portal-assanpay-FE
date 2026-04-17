import { z } from "zod"

// ── Enum Constants ──────────────────────────────────────────────────────────

export const WEBSITE_CMS_OPTIONS = [
  { value: "wordpress", label: "WordPress" },
  { value: "shopify", label: "Shopify" },
  { value: "custom_website", label: "Custom Website" },
] as const

export const MERCHANT_TYPES = [
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "private_limited_company", label: "Private Limited Company" },
  { value: "partnership", label: "Partnership" },
  { value: "limited_liability_partnership", label: "Limited Liability Partnership" },
  { value: "ngo_npo_charity", label: "NGO / NPO / Charity" },
  { value: "trust_society_association", label: "Trust / Society / Association" },
] as const

export const KIN_RELATIONS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
  { value: "wife", label: "Wife" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
] as const

export const BANK_NAMES = [
  "Advans Microfinance Bank",
  "Al Baraka Islamic Bank Limited",
  "Bank AlFalah Limited",
  "Allied Bank Limited",
  "Apna Microfinance Bank",
  "Askari Commercial Bank Limited",
  "Bank of Khyber",
  "Bank Islami Pakistan Limited",
  "Burj Bank Limited",
  "Citi Bank",
  "Dubai Islamic Bank Pakistan Limited",
  "FINCA",
  "Finja",
  "First Women Bank",
  "Faysal Bank Limited",
  "Habib Bank Limited",
  "Habib Metropolitan Bank",
  "ICBC",
  "JS Bank",
  "KASB Bank",
  "MCB Bank Limited",
  "MCB Arif Habib",
  "MCB Islamic Bank",
  "Meezan Bank",
  "Mobilink Microfinance Bank",
  "NayaPay",
  "National Bank of Pakistan",
  "NIB Bank",
  "NRSP Bank Fori Cash",
  "Paymax",
  "Sadapay",
  "Standard Chartered Bank",
  "Samba Bank",
  "Silkbank",
  "Sindh Bank",
  "Soneri Bank Limited",
  "Summit Bank",
  "TAG",
  "United Bank Limited",
  "Upaisa",
  "ZTBL",
  "EasyPaisa",
  "JazzCash",
] as const

// ── Zod Enum Tuples ─────────────────────────────────────────────────────────

const websiteCmsValues = WEBSITE_CMS_OPTIONS.map((o) => o.value) as [string, ...string[]]
const merchantTypeValues = MERCHANT_TYPES.map((o) => o.value) as [string, ...string[]]
const kinRelationValues = KIN_RELATIONS.map((o) => o.value) as [string, ...string[]]
const bankNameValues = BANK_NAMES as unknown as [string, ...string[]]

// ── Form Schema ─────────────────────────────────────────────────────────────

export const merchantOnboardingSchema = z.object({
  // Section 1: Submitter
  email: z
    .string()
    .min(1, "Submitter email is required.")
    .email("Must be a valid email address."),

  // Section 2: Owner
  ownerFullName: z
    .string()
    .min(1, "Owner full name is required."),
  ownerPhone: z
    .string()
    .min(1, "Owner phone number is required."),

  // Section 3: Business Information
  businessName: z
    .string()
    .min(1, "Business name is required."),
  businessPhone: z
    .string()
    .min(1, "Business phone number is required."),
  businessEmail: z
    .string()
    .min(1, "Business email is required.")
    .email("Must be a valid email address."),
  businessAddress: z
    .string()
    .min(1, "Business address is required."),
  businessWebsite: z
    .string()
    .min(1, "Business website is required.")
    .url("Must be a valid URL (include https://)."),
  websiteCms: z.enum(websiteCmsValues, "Please select a website platform."),
  businessDescription: z
    .string()
    .min(1, "Business description is required."),
  businessRegistrationDate: z
    .string()
    .min(1, "Business registration date is required.")
    .refine(
      (val) => {
        const date = new Date(val)
        return !isNaN(date.getTime()) && date <= new Date()
      },
      "Registration date cannot be in the future."
    ),
  businessNature: z
    .string()
    .min(1, "Nature of business is required."),

  // Section 4: Business Classification
  merchantType: z.enum(merchantTypeValues, "Please select a merchant type."),
  estimatedMonthlyTransactions: z
    .string()
    .min(1, "Estimated monthly transactions is required.")
    .refine(
      (val) => {
        const num = Number(val)
        return Number.isInteger(num) && num > 0
      },
      "Must be a whole number greater than 0."
    ),
  estimatedMonthlyVolume: z
    .string()
    .min(1, "Estimated monthly volume is required.")
    .refine(
      (val) => {
        const num = Number(val)
        return !isNaN(num) && num > 0
      },
      "Must be a number greater than 0."
    ),

  // Section 5: Financial Information
  accountTitle: z
    .string()
    .min(1, "Account title is required."),
  bankName: z.enum(bankNameValues, "Please select a bank."),
  branchName: z
    .string()
    .min(1, "Branch name is required."),
  accountNumberIban: z
    .string()
    .min(1, "Account number / IBAN is required."),
  swiftCode: z.string().optional(),

  // Section 6: Next of Kin
  nextOfKinRelation: z.enum(kinRelationValues, "Please select a relation."),
})

export type MerchantOnboardingFormValues = z.infer<typeof merchantOnboardingSchema>

// ── Document Configuration ──────────────────────────────────────────────────

export type DocumentFieldName =
  | "owner_cnic_front"
  | "owner_cnic_back"
  | "next_of_kin_cnic_front"
  | "next_of_kin_cnic_back"
  | "utility_bill"
  | "company_ntn"
  | "authority_letter"
  | "taxpayer_registration_certificate"
  | "company_incorporation_certificate"
  | "memorandum_articles"
  | "form_ii"
  | "form_a"
  | "board_resolution"
  | "certificate_of_commencement"
  | "partnership_deed"
  | "form_c"
  | "llp_form_iii"
  | "annual_audited_accounts"
  | "other_entity_certification"
  | "secp_section_42_license"
  | "risk_assessment_documents"
  | "by_laws_rules_regulations"

export const DOCUMENT_LABELS: Record<DocumentFieldName, string> = {
  owner_cnic_front: "Owner CNIC Front",
  owner_cnic_back: "Owner CNIC Back",
  next_of_kin_cnic_front: "Next Of Kin CNIC Front",
  next_of_kin_cnic_back: "Next Of Kin CNIC Back",
  utility_bill: "Utility Bill",
  company_ntn: "Company NTN",
  authority_letter: "Authority Letter",
  taxpayer_registration_certificate: "Taxpayer Registration Certificate",
  company_incorporation_certificate: "Company Incorporation Certificate",
  memorandum_articles: "Memorandum & Articles",
  form_ii: "Form II",
  form_a: "Form A",
  board_resolution: "Board Resolution",
  certificate_of_commencement: "Certificate Of Commencement",
  partnership_deed: "Partnership Deed",
  form_c: "Form C",
  llp_form_iii: "LLP Form III",
  annual_audited_accounts: "Annual Audited Accounts",
  other_entity_certification: "Other Entity Certification",
  secp_section_42_license: "SECP Section 42 License",
  risk_assessment_documents: "Risk Assessment Documents",
  by_laws_rules_regulations: "By Laws / Rules / Regulations",
}

export const BASE_DOCUMENTS: DocumentFieldName[] = [
  "owner_cnic_front",
  "owner_cnic_back",
  "next_of_kin_cnic_front",
  "next_of_kin_cnic_back",
  "utility_bill",
]

type MerchantTypeKey = (typeof MERCHANT_TYPES)[number]["value"]

export const MERCHANT_SPECIFIC_DOCUMENTS: Record<
  MerchantTypeKey,
  { required: DocumentFieldName[]; optional: DocumentFieldName[] }
> = {
  sole_proprietorship: {
    required: ["company_ntn"],
    optional: ["authority_letter", "taxpayer_registration_certificate"],
  },
  private_limited_company: {
    required: ["company_ntn", "company_incorporation_certificate"],
    optional: [
      "memorandum_articles",
      "form_ii",
      "form_a",
      "board_resolution",
      "certificate_of_commencement",
    ],
  },
  partnership: {
    required: ["company_ntn"],
    optional: ["authority_letter", "partnership_deed", "form_c"],
  },
  limited_liability_partnership: {
    required: ["company_ntn", "company_incorporation_certificate"],
    optional: ["authority_letter", "partnership_deed", "llp_form_iii"],
  },
  ngo_npo_charity: {
    required: ["company_ntn", "company_incorporation_certificate"],
    optional: [
      "memorandum_articles",
      "form_ii",
      "form_a",
      "board_resolution",
      "annual_audited_accounts",
      "other_entity_certification",
      "secp_section_42_license",
      "risk_assessment_documents",
      "by_laws_rules_regulations",
    ],
  },
  trust_society_association: {
    required: ["company_ntn"],
    optional: [
      "board_resolution",
      "annual_audited_accounts",
      "other_entity_certification",
    ],
  },
}

// ── File Validation ─────────────────────────────────────────────────────────

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]
export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"]
