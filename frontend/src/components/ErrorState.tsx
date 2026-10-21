import { CloudOff } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { useI18n } from '../i18n/t'
import { ApiError } from '../lib/api'

// What happened, in the rider's language, and what to do next. Never a stack trace.
export function ErrorState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const { t, lang } = useI18n()
  const message = error instanceof ApiError ? (lang === 'ms' ? error.messageMs : error.messageEn) : t('common.loadFailed')
  return (
    <section role="alert" className="rounded-lg border border-line bg-surface">
      <EmptyState icon={CloudOff} body={message}>
        {onRetry && (
          <button type="button" className="btn btn-secondary mt-2 w-auto" onClick={onRetry}>
            {t('common.tryAgainButton')}
          </button>
        )}
      </EmptyState>
    </section>
  )
}
