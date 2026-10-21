import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowUp, ArrowUpRight, BadgeAlert, Calculator, ChevronRight, Lightbulb, MessageSquareWarning, Sparkles } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Columns } from '../../components/Columns'
import { GuideButton, GuideHint } from '../../components/Guide'
import { RiskBadge } from '../../components/RiskBadge'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Skeleton } from '../../components/Skeleton'
import { useI18n, type Key } from '../../i18n/t'
import { ApiError, api, celikQuery, errorText, type Message, messagesQuery, metaQuery, prefetch } from '../../lib/api'
import { Tooltip } from '../../components/Tooltip'

export const Route = createFileRoute('/_app/tanya')({ loader: prefetch(metaQuery, messagesQuery, celikQuery), component: Tanya })

const SUGGESTED: Key[] = ['tanya.s1', 'tanya.s2', 'tanya.s3', 'tanya.s4']

// Every number Tanya shows passed the number guard, so they're all from the engine or the rider: bold them.
function withBoldNumbers(text: string): ReactNode {
  return text.split(/(RM\s?[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?\s?%)/g).map((part, i) => (i % 2 ? <b key={i} className="tabular-nums">{part}</b> : <Fragment key={i}>{part}</Fragment>))
}

// Tanya (FR-ADV-1..4, 9): chat over the engine. Semak Layak and the lender check work without the AI.
function Tanya() {
  const { t, lang } = useI18n()
  const meta = useQuery(metaQuery)
  const history = useQuery(messagesQuery)
  const celik = useQuery(celikQuery)
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const ask = useMutation({
    mutationFn: (message: string) => api<Message>('/api/tanya/messages', { body: { message } }),
    onMutate: (message) => setPending(message),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['messages'] })
      setPending(null)
    },
  })
  const started = (history.data?.length ?? 0) > 0 || pending !== null
  useEffect(() => {
    if (started) end.current?.scrollIntoView({ block: 'end' }) // braces: newer browsers return a Promise, which React would call as cleanup
  }, [history.data?.length, pending, started])
  const send = (m: string) => {
    if (m.trim() && !ask.isPending) {
      ask.mutate(m.trim())
      setText('')
    }
  }
  const aiOff = meta.data?.llmEnabled === false || (ask.error instanceof ApiError && ask.error.code === 'llm_unconfigured')

  return (
    <>
      <ScreenHeader
        title={t('tanya.title')}
        action={
          <div className="flex gap-1">
            <GuideButton screen="tanya" />
            {started && (
              <>
              <Tooltip side="bottom" text={t('layak.title')}><Link to="/layak" aria-label={t('layak.title')} className="pressable grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text">
                <Calculator size={20} aria-hidden />
              </Link></Tooltip>
              <Tooltip side="bottom" text={t('lender.title')}><Link to="/pemberi" aria-label={t('lender.title')} className="pressable grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text">
                <BadgeAlert size={20} aria-hidden />
              </Link></Tooltip>
              <Tooltip side="bottom" text={t('scam.title')}><Link to="/semak" aria-label={t('scam.title')} className="pressable grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text">
                <MessageSquareWarning size={20} aria-hidden />
              </Link></Tooltip>
            </>
            )}
          </div>
        }
      />
      <GuideHint screen="tanya" />

      {/* Desktop: tools and Celik are a side panel, always there; phones: above the chat, until it starts */}
      <Columns>
      <div className="col lg:col-start-2 lg:row-start-1">
        <section aria-labelledby="tools" data-tour="tools" className={`flex flex-col gap-2 ${started && !aiOff ? 'max-lg:hidden' : ''}`}>
          <h2 id="tools" className="px-1 text-sm font-semibold text-muted">{t('tanya.tools')}</h2>
          <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
            <ToolRow to="/layak" icon={<Calculator size={20} aria-hidden />} title={t('layak.title')} sub={t('layak.entry')} />
            <ToolRow to="/pemberi" icon={<BadgeAlert size={20} aria-hidden />} title={t('lender.title')} sub={t('lender.entry')} />
            <ToolRow to="/semak" icon={<MessageSquareWarning size={20} aria-hidden />} title={t('scam.title')} sub={t('scam.entry')} />
          </div>
        </section>

      {celik.data && celik.data.length > 0 && (
        <section aria-labelledby="celik" className={`flex flex-col gap-2 ${started ? 'max-lg:hidden' : ''}`}>
          <h2 id="celik" className="flex items-center gap-1.5 px-1 text-sm font-semibold text-muted"><Lightbulb size={16} aria-hidden /> {t('celik.title')}</h2>
          {/* scroll-px keeps snapped cards on the page's left edge instead of flush to the screen */}
          {/* a swipeable row on phones; a stacked list in the desktop side panel */}
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" data-no-swipe>
            {celik.data.map((l) => (
              <article key={l.topic} className="flex w-[78%] max-w-72 shrink-0 snap-start flex-col gap-1 rounded-[var(--radius-md)] border border-line bg-surface p-4 lg:w-auto lg:max-w-none">
                <h3 className="font-semibold leading-snug">{l.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{l.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      </div>

      <div className="col lg:col-start-1 lg:row-start-1">
      <section aria-label={t('tanya.chat')} aria-live="polite" className="flex flex-col gap-3">
        <p className="mx-auto max-w-sm text-center text-xs leading-relaxed text-muted">
          {t('common.disclaimer')}{' '}
          <Link to="/privacy" className="inline-flex items-center gap-0.5 underline underline-offset-2">{t('tanya.whereData')}<ChevronRight size={12} aria-hidden /></Link>
        </p>
        {aiOff ? (
          <p className="flex items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 text-sm leading-relaxed">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            {t('tanya.aiOff')}
          </p>
        ) : history.isPending ? (
          <>
            <Skeleton className="h-12 w-2/3 self-end" />
            <Skeleton className="h-20 w-5/6" />
          </>
        ) : !started ? (
          <>
            <Bubble m={{ role: 'assistant', content: t('tanya.hello'), risk: null, at: '' }} />
            <h2 className="mt-2 px-1 text-sm font-semibold text-muted">{t('tanya.tryAsking')}</h2>
            <div className="flex flex-col gap-2">
              {SUGGESTED.map((k) => (
                <button key={k} type="button" onClick={() => send(t(k))} disabled={ask.isPending} className="pressable flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 text-left text-sm font-medium hover:bg-surface-2">
                  {t(k)}
                  <ArrowUpRight size={16} className="shrink-0 text-muted" aria-hidden />
                </button>
              ))}
            </div>
          </>
        ) : null}
        {history.data?.map((m, i) => <Bubble key={m.id ?? i} m={m} />)}
        {pending && (
          <>
            <Bubble m={{ role: 'user', content: pending, risk: null, at: '' }} />
            <div role="status" className="flex items-center gap-2 self-start rounded-[var(--radius-md)] rounded-bl-sm bg-surface px-4 py-3 text-sm text-muted">
              <span className="flex gap-1" aria-hidden>
                {[0, 150, 300].map((d) => <span key={d} className="size-1.5 rounded-full bg-current motion-safe:animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </span>
              {t('tanya.thinking')}
            </div>
          </>
        )}
        {ask.isError && !aiOff && <p role="alert" className="text-sm font-semibold text-[var(--risky)]">{errorText(ask.error, lang, t('common.tryAgain'))}</p>}
        {/* scroll-margin clears the pinned composer and the bottom nav when scrolling to the newest message */}
        <div ref={end} className="scroll-mb-[calc(11rem+env(safe-area-inset-bottom))] lg:scroll-mb-24" />
      </section>

      {!aiOff && (
        <>
          <div aria-hidden className="h-24 lg:hidden" />
          {/* Pinned above the bottom nav on phones; sticks to the bottom of the column on desktop */}
          <form
            data-tour="ask"
            className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 mx-auto w-full max-w-[480px] bg-bg px-4 pt-2 pb-8 lg:sticky lg:bottom-0 lg:max-w-none lg:px-0 lg:pb-4"
            onSubmit={(e) => { e.preventDefault(); send(text) }}
          >
            <div className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 p-1.5 pl-5 shadow-[0_8px_24px_rgb(0_0_0/0.18)] focus-within:border-text">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t('tanya.placeholder')} aria-label={t('tanya.placeholder')} className="h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
              <Tooltip side="bottom" text={t('tanya.send')}><button type="submit" aria-label={t('tanya.send')} disabled={!text.trim() || ask.isPending} className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand disabled:bg-line disabled:text-muted">
                <ArrowUp size={20} strokeWidth={2.5} aria-hidden />
              </button></Tooltip>
            </div>
          </form>
        </>
      )}
      </div>
      </Columns>
    </>
  )
}

function ToolRow({ to, icon, title, sub }: { to: '/layak' | '/pemberi' | '/semak'; icon: ReactNode; title: string; sub: string }) {
  return (
    <Link to={to} className="pressable flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
      <span className="shrink-0 text-muted">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-[0.8125rem] text-muted">{sub}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </Link>
  )
}

function Bubble({ m }: { m: Message }) {
  if (m.role === 'user') return <p className="max-w-[85%] self-end whitespace-pre-wrap rounded-[var(--radius-lg)] rounded-br-md bg-brand px-4 py-2.5 text-on-brand">{m.content}</p>
  return (
    <div className="flex max-w-[88%] flex-col items-start gap-2 self-start rounded-[var(--radius-lg)] rounded-bl-md bg-surface px-4 py-3 leading-relaxed">
      {m.risk && <RiskBadge risk={m.risk} size="sm" />}
      <p className="whitespace-pre-wrap">{withBoldNumbers(m.content)}</p>
    </div>
  )
}
