import { FileText, MessageCircle, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useI18n, type Key } from '../i18n/t'

const TABS: { to: '/' | '/tabung' | '/tanya' | '/rekod'; label: Key; icon: LucideIcon }[] = [
  { to: '/', label: 'nav.gaji', icon: Wallet },
  { to: '/tabung', label: 'nav.tabung', icon: PiggyBank },
  { to: '/tanya', label: 'nav.tanya', icon: MessageCircle },
  { to: '/rekod', label: 'nav.rekod', icon: FileText },
]

export function BottomNav() {
  const { t } = useI18n()
  return (
    <nav aria-label={t('nav.label')} className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-[480px] grid-cols-4">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link to={to} activeOptions={{ exact: true }} className="flex min-h-16 flex-col items-center justify-center gap-1 py-2">
              {({ isActive }) => (
                <>
                  <span className={`grid h-8 w-16 place-items-center rounded-full ${isActive ? 'bg-brand text-on-brand' : 'text-muted'}`}>
                    <Icon size={24} strokeWidth={isActive ? 2.25 : 2} aria-hidden />
                  </span>
                  <span className={`text-xs ${isActive ? 'font-bold text-text' : 'font-medium text-muted'}`}>{t(label)}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
