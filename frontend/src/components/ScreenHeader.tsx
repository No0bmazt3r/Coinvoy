import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useI18n } from '../i18n/t'

export function ScreenHeader({ title, back = false, action }: { title: string; back?: boolean; action?: ReactNode }) {
  const { t } = useI18n()
  const router = useRouter()
  return (
    <header className="flex min-h-16 items-center gap-2 pt-[env(safe-area-inset-top)]">
      {back && (
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label={t('common.back')}
          className="-ml-2 grid size-11 place-items-center rounded-full"
        >
          <ArrowLeft size={24} aria-hidden />
        </button>
      )}
      <h1 className="flex-1 text-2xl font-bold">{title}</h1>
      {action}
    </header>
  )
}
