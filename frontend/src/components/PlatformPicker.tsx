import { Check, Plus } from 'lucide-react'
import { useI18n, type Key } from '../i18n/t'
import { PLATFORMS, type Platform } from '../lib/api'

// Each app's own logo (white) on its own colour, like its app icon, so riders find theirs at a glance. Decorative: the
// name is always beside it. Sources and licences: public/platforms/README.md.
const MARK: Record<Platform, { bg: string; src?: string }> = {
  grab: { bg: '#00B14F', src: '/platforms/grab.svg' },
  foodpanda: { bg: '#D70F64', src: '/platforms/foodpanda.svg' },
  shopeefood: { bg: '#EE4D2D', src: '/platforms/shopeefood.svg' },
  lalamove: { bg: '#F16622', src: '/platforms/lalamove.png' },
  other: { bg: 'var(--border-strong)' },
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
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] text-white" style={{ background: MARK[p].bg }}>
              {MARK[p].src ? <img src={MARK[p].src} alt="" width={20} height={20} className="size-5" /> : <Plus size={18} strokeWidth={2.5} />}
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
