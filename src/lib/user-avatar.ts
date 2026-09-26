import type { User } from '#/types/auth'

/** Gender-matched placeholder avatar used wherever a user is shown. */
export function getUserAvatarSrc(gender: User['gender']) {
  return gender === 'female'
    ? '/assets/avatar-female.webp'
    : '/assets/avatar-male.webp'
}

export function getUserInitials(name: string) {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  )
}
