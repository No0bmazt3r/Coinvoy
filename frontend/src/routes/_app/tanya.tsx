import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BadgeAlert, Calculator, ChevronRight, Lightbulb, Send } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { RiskBadge } from '../../components/RiskBadge'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Skeleton } from '../../components/Skeleton'
import { useI18n, type Key } from '../../i18n/t'
import { ApiError, api, celikQuery, errorText, type Message, messagesQuery, metaQuery } from '../../lib/api'

export const Route = createFileRoute('/_app/tanya')({ component: Tanya })

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
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' }) // braces: newer browsers return a Promise, which React would call as cleanup
  }, [history.data?.length, pending])
  const send = (m: string) => {
    if (m.trim() && !ask.isPending) {
      ask.mutate(m.trim())
      setText('')
    }
  }
  const aiOff = meta.data?.llmEnabled === false || (ask.error instanceof ApiError && ask.error.code === 'llm_unconfigured')

  return (
    <>
      <ScreenHeader title={t('tanya.title')} />
      <div className="grid grid-cols-2 gap-2">
        <Link to="/layak" className="pressable flex flex-col gap-1 rounded-lg border border-line bg-surface p-3 hover:bg-surface-2">
          <Calculator size={20} aria-hidden />
          <span className="font-semibold">{t('layak.title')}</span>
          <span className="text-[0.8125rem] text-muted">{t('layak.entry')}</span>
        </Link>
        <Link to="/pemberi" className="pressable flex flex-col gap-1 rounded-lg border border-line bg-surface p-3 hover:bg-surface-2">
          <BadgeAlert size={20} aria-hidden />
          <span className="font-semibold">{t('lender.title')}</span>
          <span className="text-[0.8125rem] text-muted">{t('lender.entry')}</span>
        </Link>
      </div>

      {celik.data && celik.data.length > 0 && (
        <section aria-labelledby="celik" className="flex flex-col gap-2">
          <h2 id="celik" className="flex items-center gap-2 px-1 text-sm font-semibold text-muted"><Lightbulb size={16} aria-hidden /> {t('celik.title')}</h2>
          <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4" data-no-swipe>
            {celik.data.map((l) => (
              <article key={l.topic} className="w-64 shrink-0 snap-start rounded-lg border border-line bg-surface p-3">
                <h3 className="font-semibold">{l.title}</h3>
                <p className="text-sm text-muted">{l.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section aria-label={t('tanya.chat')} aria-live="polite" className="flex flex-col gap-3">
        {aiOff ? (
          <p className="rounded-lg border border-line bg-surface p-4 text-sm">{t('tanya.aiOff')}</p>
        ) : history.isPending ? (
          <>
            <Skeleton className="h-12 w-2/3 self-end" />
            <Skeleton className="h-20 w-5/6" />
          </>
        ) : history.data?.length === 0 && !pending ? (
          <p className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">{t('tanya.hello')}</p>
        ) : null}
        {history.data?.map((m, i) => <Bubble key={m.id ?? i} m={m} />)}
        {pending && (
          <>
            <Bubble m={{ role: 'user', content: pending, risk: null, at: '' }} />
            <p className="text-sm text-muted">{t('tanya.thinking')}</p>
          </>
        )}
        {ask.isError && !aiOff && <p role="alert" className="text-sm font-semibold text-[var(--risky)]">{errorText(ask.error, lang, t('common.tryAgain'))}</p>}
        <div ref={end} />
      </section>

      {!aiOff && (
        <>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" data-no-swipe>
            {SUGGESTED.map((k) => (
              <button key={k} type="button" onClick={() => send(t(k))} disabled={ask.isPending} className="pressable min-h-11 shrink-0 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold">
                {t(k)}
              </button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text) }}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t('tanya.placeholder')} aria-label={t('tanya.placeholder')} className="h-12 min-w-0 flex-1 rounded-[var(--radius-md)] border border-line-strong bg-surface-2 px-3" />
            <button type="submit" aria-label={t('tanya.send')} disabled={!text.trim() || ask.isPending} className="btn btn-primary w-12 shrink-0 px-0">
              <Send size={20} aria-hidden />
            </button>
          </form>
        </>
      )}
      <p className="flex items-start gap-1 text-[0.8125rem] text-muted">{t('common.disclaimer')}</p>
      <Link to="/privacy" className="btn-ghost -mt-2 flex items-center gap-1 self-start text-[0.8125rem]">{t('tanya.whereData')} <ChevronRight size={14} aria-hidden /></Link>
    </>
  )
}

function Bubble({ m }: { m: Message }) {
  if (m.role === 'user') return <p className="ml-10 self-end rounded-[var(--radius-md)] rounded-br-sm bg-surface-2 px-4 py-2">{m.content}</p>
  return (
    <div className="mr-10 flex flex-col gap-2 self-start rounded-[var(--radius-md)] rounded-bl-sm border border-line bg-surface px-4 py-3">
      {m.risk && <RiskBadge risk={m.risk} size="sm" />}
      <p>{withBoldNumbers(m.content)}</p>
    </div>
  )
}
