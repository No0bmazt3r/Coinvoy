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
      <EmptyState icon={icon} body={t(body)}>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-muted">{t('common.soon')}</span>
      </EmptyState>
    </>
  )
}
