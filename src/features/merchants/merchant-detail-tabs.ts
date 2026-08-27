import { FileText, History, LayoutGrid, Wallet } from 'lucide-react'

export const MERCHANT_DETAIL_TABS = [
  {
    to: '/merchants/$merchantId/overview',
    label: 'Overview',
    icon: LayoutGrid,
  },
  {
    to: '/merchants/$merchantId/form',
    label: 'Form and Agreement',
    icon: FileText,
  },
  {
    to: '/merchants/$merchantId/limits',
    label: 'MDR & Limits',
    icon: Wallet,
  },
  {
    to: '/merchants/$merchantId/history',
    label: 'History',
    icon: History,
  },
] as const
