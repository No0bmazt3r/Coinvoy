import { Link } from '@tanstack/react-router'
import { Flame, Snowflake } from 'lucide-react'
import { useI18n } from '../i18n/t'
import type { Streak } from '../lib/api'

// Weeks logged in a row; a snowflake while leave or sick days freeze it (design-system §6.6, FR-STRK-6).
export function StreakChip({ streak }: { streak: Streak }) {
  const { t } = useI18n()
  const frozen = streak.frozenThisWeek
  return (
    <Link
      to="/pencapaian"
      aria-label={t('streak.aria', { n: streak.weeks })}
      className={`pressable inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-bold tabular-nums ${streak.atRisk ? 'border-[var(--careful)] text-[var(--careful)]' : 'border-line bg-surface'}`}
    >
      {frozen ? <Snowflake size={18} aria-hidden className="text-[var(--info)]" /> : <Flame size={18} aria-hidden className="text-[var(--careful)]" />}
      {t('streak.weeks', { n: streak.weeks })}
    </Link>
  )
}
