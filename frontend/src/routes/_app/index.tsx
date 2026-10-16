import { Link, createFileRoute } from '@tanstack/react-router'
import { Camera, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useI18n, type Key } from '../../i18n/t'

export const Route = createFileRoute('/_app/')({ component: Gaji })

const STEPS: { icon: LucideIcon; title: Key; body: Key }[] = [
  { icon: Camera, title: 'gaji.step1Title', body: 'gaji.step1Body' },
  { icon: Wallet, title: 'gaji.step2Title', body: 'gaji.step2Body' },
  { icon: PiggyBank, title: 'gaji.step3Title', body: 'gaji.step3Body' },
]

// M1: the empty home. The SalaryCard replaces the empty state once /api/home exists (FR-GAJI-1).
function Gaji() {
  const { t } = useI18n()
  const { user } = Route.useRouteContext()
  return (
    <>
      <ScreenHeader title={t('gaji.greeting', { name: user.displayName.split(' ')[0] })} />
      <section className="rounded-lg border-2 border-outline bg-surface">
        <EmptyState icon={Wallet} title={t('gaji.emptyTitle')} body={t('gaji.emptyBody')}>
          <Link to="/snap" className="btn btn-primary mt-2">
            <Camera size={20} aria-hidden />
            {t('gaji.snapCta')}
          </Link>
        </EmptyState>
      </section>
      <section aria-labelledby="how" className="flex flex-col gap-3">
        <h2 id="how" className="px-1 text-sm font-semibold text-muted">
          {t('gaji.howTitle')}
        </h2>
        <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex items-start gap-3 p-4">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">
                <Icon size={20} aria-hidden />
                <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-brand text-[0.6875rem] font-bold text-on-brand">
                  {i + 1}
                </span>
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{t(title)}</p>
                <p className="text-sm text-muted">{t(body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
