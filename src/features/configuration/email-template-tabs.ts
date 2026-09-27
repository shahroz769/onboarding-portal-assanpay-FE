import {
  FilePen,
  FileUp,
  KeyRound,
  LockKeyhole,
  Rocket,
  RotateCcwKey,
} from 'lucide-react'

// The emails in the backend's email template catalog, in the order an
// onboarding runs, each a tab on the Email Templates page.
export const EMAIL_TEMPLATE_TABS = [
  {
    key: 'document-resubmission',
    label: 'Resubmission Request',
    icon: FileUp,
  },
  { key: 'mid-creation', label: 'Portal Credentials', icon: KeyRound },
  { key: 'agreement', label: 'Agreement', icon: FilePen },
  { key: 'live-activation', label: 'Live Activation', icon: Rocket },
  { key: 'user-password-invite', label: 'Password Setup', icon: LockKeyhole },
  { key: 'user-password-reset', label: 'Password Reset', icon: RotateCcwKey },
] as const
