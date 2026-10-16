import type { User } from '../lib/api'

// Google photo, or the first initial on lime for demo users and accounts without one.
export function Avatar({ user, className = 'size-6 text-xs' }: { user: Pick<User, 'displayName' | 'avatarUrl'>; className?: string }) {
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className={`rounded-full object-cover ${className}`} />
  ) : (
    <span aria-hidden className={`grid place-items-center rounded-full bg-brand font-bold text-on-brand ${className}`}>
      {user.displayName.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
