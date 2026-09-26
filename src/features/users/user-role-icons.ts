import { CrownIcon, HeadsetIcon, ShieldUserIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { RoleType } from '#/types/auth'

export const USER_ROLE_ICONS: Record<RoleType, LucideIcon> = {
  super_admin: CrownIcon,
  admin: ShieldUserIcon,
  agent: HeadsetIcon,
}
