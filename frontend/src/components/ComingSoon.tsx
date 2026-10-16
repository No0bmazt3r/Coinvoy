import type { LucideIcon } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { ScreenHeader } from './ScreenHeader'
import { useI18n, type Key } from '../i18n/t'

// Stand-in for tabs whose milestone hasn't landed yet (PRD §11).
export function ComingSoon({ title, body, icon, back = false }: { title: Key; body: Key; icon: LucideIcon; back?: boolean }) {
  const { t } = useI18n()
  return (
    <>
      <ScreenHeader title={t(title)} back={back} />
      <section className="rounded-lg border border-line bg-surface">
        <EmptyState icon={icon} body={t(body)}>
          <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold tracking-wide text-muted uppercase">
            {t('common.soon')}
          </span>
        </EmptyState>
      </section>
    </>
  )
}
