import { Minus, Plus } from 'lucide-react'
import { useI18n } from '../i18n/t'
import { Tooltip } from './Tooltip'

const PRESETS = [20, 30, 40, 50, 60]
const MAX = 84

// Hours per week with big − / + buttons and quick presets. We dropped the slider because it's hard to drag
// precisely, especially for older riders.
export function HoursField({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) {
  const { t } = useI18n()
  const set = (h: number) => onChange(Math.min(MAX, Math.max(0, h)))
  const step = 'pressable grid size-15 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 disabled:opacity-40'
  return (
    <div className="flex flex-col gap-3" role="group" aria-label={label}>
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-3">
        <Tooltip side="bottom" text={t('hours.less')}><button type="button" className={step} aria-label={t('hours.less')} disabled={value <= 0} onClick={() => set(value - 1)}>
          <Minus size={26} aria-hidden />
        </button></Tooltip>
        <output aria-live="polite" className="text-center text-[2rem] leading-none font-extrabold tabular-nums">
          {t('onb.hoursValue', { n: value })}
        </output>
        <Tooltip side="bottom" text={t('hours.more')}><button type="button" className={step} aria-label={t('hours.more')} disabled={value >= MAX} onClick={() => set(value + 1)}>
          <Plus size={26} aria-hidden />
        </button></Tooltip>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {PRESETS.map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={value === h}
            onClick={() => set(h)}
            className={`pressable min-h-12 rounded-[var(--radius-md)] border text-sm font-semibold tabular-nums ${value === h ? 'border-text bg-text text-bg' : 'border-line-strong bg-surface'}`}
          >
            {h}
          </button>
        ))}
      </div>
    </div>
  )
}
