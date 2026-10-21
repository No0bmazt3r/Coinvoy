import { Link } from '@tanstack/react-router'
import { ChevronRight, Flame, Snowflake } from 'lucide-react'
import { useI18n, type Key } from '../i18n/t'
import type { Streak } from '../lib/api'

// The streak as progress toward the next level (FR-STRK-*): one tap to Pencapaian, amber only when it's at risk.
export function StreakRow({ streak }: { streak: Streak }) {
  const { t } = useI18n()
  const next = streak.nextLevelAt
  return (
    <Link to="/pencapaian" className="pressable flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:bg-surface-2">
      {streak.frozenThisWeek ? <Snowflake size={20} aria-hidden className="shrink-0 text-[var(--info)]" /> : <Flame size={20} aria-hidden className="shrink-0 text-[var(--careful)]" />}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-semibold tabular-nums">{t('streak.row', { n: streak.weeks })}</span>
        {next !== null && (
          <span className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <span className="block h-full rounded-full bg-text" style={{ width: `${Math.min(100, (streak.weeks / next) * 100)}%` }} />
          </span>
        )}
        {next !== null && <span className="text-[0.8125rem] text-muted tabular-nums">{t('streak.toNext', { n: next - streak.weeks, level: t(`level.${streak.level + 1}` as Key) })}</span>}
        {streak.atRisk && <span className="text-[0.8125rem] font-semibold text-[var(--careful)]">{t('streak.atRisk')}</span>}
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 text-muted" />
    </Link>
  )
}
