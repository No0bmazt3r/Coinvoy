import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { LangToggle } from '../components/LangToggle'
import { useI18n, type Key } from '../i18n/t'
import { api } from '../lib/api'

type Meta = { llmEnabled: boolean; llmProvider: string | null; llmRegion: string | null; noticeVersion: string }

export const Route = createFileRoute('/privacy')({ component: Privacy })

const SECTIONS: [Key, Key][] = [
  ['privacy.collectTitle', 'privacy.collect'],
  ['privacy.whyTitle', 'privacy.why'],
  ['privacy.screenshotsTitle', 'privacy.screenshots'],
  ['privacy.keepTitle', 'privacy.keep'],
  ['privacy.rightsTitle', 'privacy.rights'],
  ['privacy.neverTitle', 'privacy.never'],
]

// PDPA notice (NFR-7), public so it can be read before signing in. Names the AI provider and region (decisions A4).
function Privacy() {
  const { t } = useI18n()
  const router = useRouter()
  const meta = useQuery({ queryKey: ['meta'], queryFn: () => api<Meta>('/api/meta') })
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-4 pt-[env(safe-area-inset-top)] pb-10 lg:grid lg:max-w-none lg:grid-cols-[repeat(auto-fill,minmax(24rem,1fr))] lg:content-start lg:gap-6 lg:px-[clamp(1.5rem,6vw,8rem)] lg:pt-6 lg:[&>header]:col-span-full lg:[&>p]:col-span-full">
      <header className="flex min-h-16 items-center gap-2">
        <button type="button" onClick={() => router.history.back()} aria-label={t('common.back')} className="pressable -ml-2 grid size-11 place-items-center rounded-full hover:bg-surface-2">
          <ArrowLeft size={24} aria-hidden />
        </button>
        <h1 className="flex-1 text-2xl font-bold tracking-tight">{t('privacy.title')}</h1>
        <LangToggle />
      </header>
      {SECTIONS.map(([title, body]) => (
        <section key={title} className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">{t(title)}</h2>
          <p className="text-muted">{t(body)}</p>
        </section>
      ))}
      <section className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-lg font-bold">{t('privacy.aiTitle')}</h2>
        <p className="text-muted">
          {meta.data?.llmEnabled
            ? t('privacy.ai', { provider: meta.data.llmProvider ?? t('privacy.unnamed'), region: meta.data.llmRegion ?? t('privacy.unnamed') })
            : t('privacy.aiOff')}
        </p>
      </section>
      <p className="text-[0.8125rem] text-muted">{t('privacy.version', { v: meta.data?.noticeVersion ?? '…' })}</p>
    </main>
  )
}
