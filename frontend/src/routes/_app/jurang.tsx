import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Clock, Landmark, Receipt, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { ErrorState } from '../../components/ErrorState'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Skeleton } from '../../components/Skeleton'
import { useI18n } from '../../i18n/t'
import { api } from '../../lib/api'
import { formatRM } from '../../lib/money'

type Jurang =
  | { active: false }
  | {
      active: true
      essentialsSen: number
      salarySen: number
      gapSen: number
      hours: { plannedHours: number; hours: number; extraHours: number; salarySen: number; closesGap: boolean; fatigue: boolean }
      costs: { cutSen: number; essentialsAfterSen: number }
      entitlements: { isaraanMatchRate: number; isaraanMatchCapSen: number; perkesoDeductedAtSource: boolean }
    }

export const Route = createFileRoute('/_app/jurang')({ component: JurangPage })

// Shown when income is too low: the honest gap, plus three options to close it.
function JurangPage() {
  const { t } = useI18n()
  const q = useQuery({ queryKey: ['jurang'], queryFn: () => api<Jurang>('/api/jurang') })
  const rm = (sen: number) => formatRM(sen, { whole: true })
  return (
    <>
      <ScreenHeader title={t('jurang.title')} back />
      {q.isPending ? (
        <Skeleton className="h-64" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data.active ? (
        <p className="rounded-lg border border-line bg-surface p-5">{t('jurang.none')}</p>
      ) : (
        <>
          <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-5">
            <p className="text-lg font-medium">{t('jurang.honest')}</p>
            <p className="text-sm text-muted">{t('jurang.line', { essentials: rm(q.data.essentialsSen), salary: rm(q.data.salarySen), gap: rm(q.data.gapSen) })}</p>
          </section>
          <Option icon={<Clock size={20} aria-hidden />} title={t('jurang.hoursTitle')}>
            {q.data.hours.closesGap
              ? t('jurang.hoursBody', { extra: q.data.hours.extraHours, hours: q.data.hours.hours })
              : t('jurang.hoursPartial', { hours: q.data.hours.hours, salary: rm(q.data.hours.salarySen) })}
            {q.data.hours.fatigue && (
              <span className="mt-2 flex gap-2 rounded-[var(--radius-sm)] bg-[var(--careful-bg)] p-3 text-[var(--careful)]">
                <TriangleAlert size={18} className="shrink-0" aria-hidden />
                {t('onb.fatigue')}
              </span>
            )}
          </Option>
          <Option icon={<Receipt size={20} aria-hidden />} title={t('jurang.costsTitle')}>
            {t('jurang.costsBody', { cut: rm(q.data.costs.cutSen), after: rm(q.data.costs.essentialsAfterSen) })}
          </Option>
          <Option icon={<Landmark size={20} aria-hidden />} title={t('jurang.entitlementsTitle')}>
            <span className="block">
              {t('jurang.isaraan', { rate: Math.round(q.data.entitlements.isaraanMatchRate * 100), cap: rm(q.data.entitlements.isaraanMatchCapSen) })}
            </span>
            <span className="mt-1 block">{t(q.data.entitlements.perkesoDeductedAtSource ? 'jurang.perkesoDeducted' : 'jurang.perkeso')}</span>
            <span className="mt-1 block">{t('jurang.str')}</span>
          </Option>
          <p className="text-[0.8125rem] text-muted">{t('common.disclaimer')}</p>
        </>
      )}
    </>
  )
}

function Option({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-3 rounded-lg border border-line bg-surface p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">{icon}</span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted">{children}</p>
      </div>
    </section>
  )
}
