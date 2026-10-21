import { OctagonAlert, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useI18n } from '../i18n/t'
import type { Risk } from '../lib/api'

const LOOK = {
  selamat: { Icon: ShieldCheck, cls: 'bg-[var(--safe-bg)] text-[var(--safe)]' },
  berhati: { Icon: TriangleAlert, cls: 'bg-[var(--careful-bg)] text-[var(--careful)]' },
  berisiko: { Icon: OctagonAlert, cls: 'bg-[var(--risky-bg)] text-[var(--risky)]' },
} as const

// Word and icon, never colour alone; the % is secondary.
export function RiskBadge({ risk, pSafe, size = 'md' }: { risk: Risk; pSafe?: number; size?: 'sm' | 'md' }) {
  const { t } = useI18n()
  const { Icon, cls } = LOOK[risk]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${cls} ${size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`}>
      <Icon size={size === 'md' ? 16 : 14} aria-hidden />
      {t(`risk.${risk}`)}
      {pSafe !== undefined && <span className="font-medium tabular-nums opacity-80">· {Math.round(pSafe * 100)}%</span>}
    </span>
  )
}
