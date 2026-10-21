import { Check } from 'lucide-react'
import { useI18n, type Key } from '../i18n/t'
import { PLATFORMS, type Platform } from '../lib/api'

// Each app's own colour on a small mark, so riders find theirs at a glance. Decorative: the name is always beside it.
const MARK: Record<Platform, { bg: string; letter: string }> = {
  grab: { bg: '#00B14F', letter: 'G' },
  foodpanda: { bg: '#D70F64', letter: 'f' },
  shopeefood: { bg: '#EE4D2D', letter: 'S' },
  lalamove: { bg: '#F16622', letter: 'L' },
  other: { bg: 'var(--border-strong)', letter: '+' },
}

/** Multi-select tiles for the apps a rider works on: one per row on phones so every name fits, two on wider screens. */
export function PlatformPicker({ value, onChange }: { value: Platform[]; onChange: (v: Platform[]) => void }) {
  const { t } = useI18n()
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={t('onb.platformsTitle')}>
      {PLATFORMS.map((p) => {
        const on = value.includes(p)
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== p) : [...value, p])}
            className={`pressable flex min-h-14 items-center gap-3 rounded-[var(--radius-md)] border px-3 text-left font-semibold ${on ? 'border-text bg-surface-2' : 'border-line bg-surface hover:border-line-strong'}`}
          >
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-sm font-extrabold text-white" style={{ background: MARK[p].bg }}>
              {MARK[p].letter}
            </span>
            <span className="min-w-0 flex-1 truncate">{t(`platform.${p}` as Key)}</span>
            <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full border ${on ? 'border-text bg-text text-bg' : 'border-line-strong'}`}>
              {on && <Check size={14} strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
