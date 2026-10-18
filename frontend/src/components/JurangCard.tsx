import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useI18n } from '../i18n/t'
import { formatRM } from '../lib/money'

// Honest, not alarming: a neutral surface, never red (design-system §6.6, FR-ADV-7).
export function JurangCard({ essentialsSen, salarySen, gapSen }: { essentialsSen: number; salarySen: number; gapSen: number }) {
  const { t } = useI18n()
  const rm = (sen: number) => formatRM(sen, { whole: true })
  return (
    <section aria-labelledby="jurang-title" className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <h2 id="jurang-title" className="font-semibold">
        {t('jurang.title')}
      </h2>
      <p className="text-[2rem] leading-[2.375rem] font-extrabold tabular-nums">{rm(gapSen)}</p>
      <p className="text-sm text-muted">{t('jurang.line', { essentials: rm(essentialsSen), salary: rm(salarySen), gap: rm(gapSen) })}</p>
      <Link to="/jurang" className="pressable -mx-1 mt-1 flex min-h-11 items-center justify-between rounded-[var(--radius-sm)] px-1 font-semibold hover:bg-surface-2">
        {t('jurang.options')}
        <ChevronRight size={20} aria-hidden />
      </Link>
    </section>
  )
}
