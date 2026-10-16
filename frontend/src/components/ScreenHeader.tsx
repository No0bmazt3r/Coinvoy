import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useI18n } from '../i18n/t'

export function ScreenHeader({ title, back = false, action }: { title: string; back?: boolean; action?: ReactNode }) {
  const { t } = useI18n()
  const router = useRouter()
  return (
    <header className="sticky top-0 z-10 -mx-4 flex min-h-16 items-center gap-2 bg-bg/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      {back && (
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label={t('common.back')}
          className="pressable -ml-2 grid size-11 place-items-center rounded-full hover:bg-surface-2"
        >
          <ArrowLeft size={24} aria-hidden />
        </button>
      )}
      <h1 className="flex-1 text-2xl font-bold tracking-tight">{title}</h1>
      {action}
    </header>
  )
}
