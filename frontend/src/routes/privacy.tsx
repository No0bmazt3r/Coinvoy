import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  ArrowLeft, Ban, Clock, Database, Download, ImageOff, Inbox, Mail, Scale, ShieldCheck, Sparkles, Target, UserCheck, type LucideIcon,
} from 'lucide-react'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { LangToggle } from '../components/LangToggle'
import { useI18n, type Key } from '../i18n/t'
import { metaQuery } from '../lib/api'

export const Route = createFileRoute('/privacy')({ component: Privacy })

// A layered notice: four short points first (they fit on one phone screen), then the detail, one topic per section.
// It covers what PDPA section 7 asks for: what, why, where it comes from, who sees it, what's required, rights, contact.
const GLANCE: { icon: LucideIcon; text: Key }[] = [
  { icon: ShieldCheck, text: 'privacy.g1' },
  { icon: ImageOff, text: 'privacy.g2' },
  { icon: Download, text: 'privacy.g3' },
  { icon: Sparkles, text: 'privacy.g4' },
]

type Section = { id: string; icon: LucideIcon; title: Key; body?: Key }
const SECTIONS: Section[] = [
  { id: 'collect', icon: Database, title: 'privacy.collectTitle', body: 'privacy.collect' },
  { id: 'source', icon: Inbox, title: 'privacy.sourceTitle', body: 'privacy.source' },
  { id: 'why', icon: Target, title: 'privacy.whyTitle', body: 'privacy.why' },
  { id: 'required', icon: UserCheck, title: 'privacy.requiredTitle', body: 'privacy.required' },
  { id: 'screenshots', icon: ImageOff, title: 'privacy.screenshotsTitle', body: 'privacy.screenshots' },
  { id: 'ai', icon: Sparkles, title: 'privacy.aiTitle' },
  { id: 'keep', icon: Clock, title: 'privacy.keepTitle', body: 'privacy.keep' },
  { id: 'rights', icon: Scale, title: 'privacy.rightsTitle', body: 'privacy.rights' },
  { id: 'never', icon: Ban, title: 'privacy.neverTitle', body: 'privacy.never' },
  { id: 'contact', icon: Mail, title: 'privacy.contactTitle' },
]

/** The section being read, for the desktop contents list: the last one whose heading has reached the top quarter. */
function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0]!.id)
  useEffect(() => {
    const onScroll = () => {
      const line = innerHeight / 4
      const passed = SECTIONS.filter((s) => (document.getElementById(s.id)?.getBoundingClientRect().top ?? Infinity) <= line)
      // at the very bottom the last short sections can't reach the line, so the last one wins
      const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2
      setActive(atEnd ? SECTIONS.at(-1)!.id : (passed.at(-1) ?? SECTIONS[0]!).id)
    }
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [])
  return active
}

// The PDPA notice: public, so it can be read before signing in. Names the AI provider and where it processes data.
function Privacy() {
  const { t } = useI18n()
  const router = useRouter()
  const meta = useQuery(metaQuery)
  const active = useActiveSection()

  const extra: Record<string, ReactNode> = {
    ai: meta.data?.llmEnabled ? (
      <>
        <p>
          <span className="text-muted">{t('privacy.aiBy')} </span>
          <b>{meta.data.llmProvider ?? t('privacy.unnamed')}</b>
        </p>
        {meta.data.llmRegion && <p className="rounded-[var(--radius-md)] bg-surface-2 p-3 text-sm leading-relaxed">{meta.data.llmRegion}</p>}
        <p className="text-muted">{t('privacy.aiAllow')}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-muted marker:text-line-strong">
          <li>{t('privacy.shareIndex')}</li>
          <li>{t('privacy.shareOfficer')}</li>
        </ul>
      </>
    ) : (
      <p className="text-muted">{meta.data ? t('privacy.aiOff') : '…'}</p>
    ),
    contact: (
      <p className="text-muted">
        {meta.data?.privacyContact ? (
          // The sentence with the email as a link where {email} goes
          t('privacy.contact', { email: '\u0000' }).split('\u0000').map((part, i) => (
            <Fragment key={i}>
              {i > 0 && <a href={`mailto:${meta.data!.privacyContact}`} className="font-semibold text-text underline underline-offset-2">{meta.data!.privacyContact}</a>}
              {part}
            </Fragment>
          ))
        ) : (
          t('privacy.noContact')
        )}
      </p>
    ),
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[480px] px-4 pt-[env(safe-area-inset-top)] pb-16 lg:max-w-[63rem] lg:px-8">
      <header className="sticky top-0 z-10 -mx-4 flex min-h-16 items-center gap-2 bg-bg/90 px-4 backdrop-blur lg:static lg:mx-0 lg:min-h-20 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <button type="button" onClick={() => router.history.back()} aria-label={t('common.back')} className="pressable -ml-2 grid size-11 place-items-center rounded-full hover:bg-surface-2">
          <ArrowLeft size={24} aria-hidden />
        </button>
        <h1 className="flex-1 text-2xl font-bold tracking-tight">{t('privacy.title')}</h1>
        <LangToggle />
      </header>

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,42rem)] lg:justify-center lg:gap-16">
        {/* Desktop: a contents list that follows you down the page */}
        <nav aria-label={t('privacy.onThisPage')} className="max-lg:hidden">
          <div className="sticky top-8 flex flex-col gap-1">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t('privacy.onThisPage')}</p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={active === s.id ? 'location' : undefined}
                className={`rounded-[var(--radius-sm)] border-l-2 px-3 py-1.5 text-sm transition-colors ${active === s.id ? 'border-text font-semibold text-text' : 'border-transparent text-muted hover:text-text'}`}
              >
                {t(s.title)}
              </a>
            ))}
          </div>
        </nav>

        <article className="flex flex-col gap-8">
          <p className="text-lg leading-relaxed text-muted">{t('privacy.intro')}</p>

          <section aria-labelledby="glance" className="flex flex-col gap-3">
            <h2 id="glance" className="text-sm font-semibold text-muted">{t('privacy.glance')}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {GLANCE.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand"><Icon size={18} aria-hidden /></span>
                  <span className="pt-1.5 leading-snug font-medium">{t(text)}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col divide-y divide-line border-y border-line">
            {SECTIONS.map(({ id, icon: Icon, title, body }) => (
              <section key={id} id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-20 gap-4 py-6 lg:scroll-mt-8">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2"><Icon size={20} aria-hidden /></span>
                <div className="flex min-w-0 flex-1 flex-col gap-2 leading-relaxed">
                  <h2 id={`${id}-h`} className="text-lg font-bold">{t(title)}</h2>
                  {body && <p className="text-muted">{t(body)}</p>}
                  {extra[id]}
                </div>
              </section>
            ))}
          </div>

          <footer className="flex flex-col gap-1 text-[0.8125rem] text-muted">
            <p>{t('privacy.bilingual')}</p>
            <p>{t('privacy.version', { v: meta.data?.noticeVersion ?? '…' })}</p>
          </footer>
        </article>
      </div>
    </main>
  )
}
