import { Camera, CircleUser, MessageCircle, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { Avatar } from './Avatar'
import { useI18n, type Key } from '../i18n/t'
import { meQuery } from '../lib/api'

type To = '/' | '/tabung' | '/tanya' | '/settings'

// Slot index in the 5-column bar (2 is Snap). Records sits inside Profile, so it lights Profile.
const SLOT: Record<string, number> = { '/': 0, '/tabung': 1, '/snap': 2, '/tanya': 3, '/settings': 4, '/rekod': 4 }

export function BottomNav() {
  const { t } = useI18n()
  const { data: user } = useQuery(meQuery)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = SLOT[pathname] ?? -1
  const pill = active === 2 ? -1 : active

  const tab = (slot: number, to: To, label: Key, Icon: LucideIcon, avatar = false) => {
    const on = slot === active
    return (
      <li className="relative">
        <Link to={to} aria-current={on ? 'page' : undefined} className="pressable flex h-16 flex-col items-center gap-1 pt-2">
          <span
            className={`grid h-8 w-14 place-items-center transition-colors duration-200 ${on ? 'text-on-brand' : 'text-muted'}`}
          >
            <span key={String(on)} className={`grid ${on ? 'nav-pop' : ''}`}>
              {avatar && user ? (
                <Avatar user={user} className={`size-6 text-[0.6875rem] ${on ? 'ring-2 ring-on-brand/80' : ''}`} />
              ) : (
                <Icon size={22} strokeWidth={on ? 2.4 : 2} aria-hidden />
              )}
            </span>
          </span>
          <span className={`text-[0.6875rem] transition-colors duration-200 ${on ? 'font-bold text-text' : 'font-medium text-muted'}`}>
            {t(label)}
          </span>
        </Link>
      </li>
    )
  }

  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="relative mx-auto grid max-w-[480px] grid-cols-5">
        {/* One lime pill that glides between tabs instead of each tab fading its own */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-2 left-0 flex w-1/5 justify-center transition-[transform,opacity] duration-300 ease-[var(--ease-out)]"
          style={{ transform: `translateX(${Math.max(pill, 0) * 100}%)`, opacity: pill < 0 ? 0 : 1 }}
        >
          <span className="h-8 w-14 rounded-full bg-brand" />
        </span>
        {tab(0, '/', 'nav.gaji', Wallet)}
        {tab(1, '/tabung', 'nav.tabung', PiggyBank)}
        <li className="relative grid place-items-center">
          <Link
            to="/snap"
            aria-label={t('snap.title')}
            aria-current={active === 2 ? 'page' : undefined}
            className={`pressable -mt-7 grid size-15 place-items-center rounded-full border-[5px] border-bg bg-brand text-on-brand hover:scale-105 ${
              active === 2 ? 'outline-2 outline-offset-2 outline-brand' : ''
            }`}
          >
            <Camera size={26} strokeWidth={2.25} aria-hidden />
          </Link>
        </li>
        {tab(3, '/tanya', 'nav.tanya', MessageCircle)}
        {tab(4, '/settings', 'nav.profil', CircleUser, true)}
      </ul>
    </nav>
  )
}
