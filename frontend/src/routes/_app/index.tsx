import { Link, createFileRoute } from '@tanstack/react-router'
import { Camera, Settings, Wallet } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useI18n } from '../../i18n/t'

export const Route = createFileRoute('/_app/')({ component: Gaji })

// M1: the empty home. The SalaryCard replaces the empty state once /api/home exists (FR-GAJI-1).
function Gaji() {
  const { t } = useI18n()
  const { user } = Route.useRouteContext()
  return (
    <>
      <ScreenHeader
        title={t('gaji.greeting', { name: user.displayName.split(' ')[0] })}
        action={
          <Link to="/settings" aria-label={t('settings.open')} className="-mr-2 grid size-11 place-items-center rounded-full">
            <Settings size={24} aria-hidden />
          </Link>
        }
      />
      <section className="rounded-lg border-2 border-dashed border-line-strong bg-surface">
        <EmptyState icon={Wallet} title={t('gaji.emptyTitle')} body={t('gaji.emptyBody')}>
          <Link to="/snap" className="btn btn-primary mt-2">
            <Camera size={20} aria-hidden />
            {t('gaji.snapCta')}
          </Link>
        </EmptyState>
      </section>
    </>
  )
}
