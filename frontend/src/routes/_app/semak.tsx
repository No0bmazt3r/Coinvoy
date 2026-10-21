import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink, Link2, OctagonAlert, Phone, ShieldCheck, ShieldQuestion, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { ResultPlaceholder } from '../../components/EmptyState'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useI18n, type Key } from '../../i18n/t'
import { api, errorText } from '../../lib/api'

type Result = {
  level: 'tinggi' | 'sederhana' | 'rendah'
  flags: string[]
  extraFlags: string[]
  links: { host: string; official: boolean; lookalikeOf: string | null }[]
  phones: string[]
  usedAi: boolean
}

export const Route = createFileRoute('/_app/semak')({ component: MessageCheck })

const LOOK = {
  tinggi: { Icon: OctagonAlert, cls: 'bg-[var(--risky-bg)] text-[var(--risky)]' },
  sederhana: { Icon: TriangleAlert, cls: 'bg-[var(--careful-bg)] text-[var(--careful)]' },
  rendah: { Icon: ShieldCheck, cls: 'bg-[var(--safe-bg)] text-[var(--safe)]' },
}
const SEMAK_MULE = 'https://semakmule.rmp.gov.my'

// Semak Mesej: shows the warning signs in a pasted message and what to do next.
// We never say "this is a scam", and a clean result never says "safe".
function MessageCheck() {
  const { t, lang } = useI18n()
  const [text, setText] = useState('')
  const check = useMutation({ mutationFn: () => api<Result>('/api/scam-check', { body: { text } }) })
  const r = check.data
  return (
    <>
      <ScreenHeader title={t('scam.title')} back />
      <p className="text-muted">{t('scam.body')}</p>
      <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 5) check.mutate() }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={2000} placeholder={t('scam.placeholder')} aria-label={t('scam.placeholder')} className="rounded-[var(--radius-md)] border border-line-strong bg-surface-2 p-3" />
          <button type="submit" className="btn btn-primary" disabled={text.trim().length < 5 || check.isPending}>{t('scam.check')}</button>
          {check.isError && <p role="alert" className="text-sm font-semibold text-[var(--risky)]">{errorText(check.error, lang, t('common.tryAgain'))}</p>}
          <p className="text-[0.8125rem] text-muted">{t('scam.private')}</p>
        </form>
        {!r && <ResultPlaceholder icon={ShieldQuestion} body={t('common.resultHere')} />}
        {r && (() => {
          const { Icon, cls } = LOOK[r.level]
          return (
            <section aria-live="polite" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
              <p className={`flex items-center gap-2 self-start rounded-full px-3 py-1 font-semibold ${cls}`}><Icon size={18} aria-hidden /> {t(`scam.level.${r.level}` as Key)}</p>
              {r.flags.length + r.extraFlags.length > 0 ? (
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
                  {r.flags.map((f) => <li key={f}>{t(`scam.flag.${f}` as Key)}</li>)}
                  {r.extraFlags.map((f) => <li key={f}>{f}</li>)}
                </ul>
              ) : (
                <p className="text-sm">{t('scam.none')}</p>
              )}
              {r.links.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-sm font-semibold">{t('scam.links')}</h2>
                  {r.links.map((l) => (
                    <p key={l.host} className="flex items-start gap-2 text-sm">
                      <Link2 size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <b className="break-all">{l.host}</b> · {l.official ? t('scam.linkOfficial') : l.lookalikeOf ? t('scam.linkLookalike', { brand: t(`scam.brand.${l.lookalikeOf}` as Key) }) : t('scam.linkUnknown')}
                      </span>
                    </p>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <h2 className="text-sm font-semibold">{t('scam.next')}</h2>
                <p className="text-sm">{t('scam.neverShare')}</p>
                <a href={SEMAK_MULE} target="_blank" rel="noopener noreferrer" className="pressable flex items-center gap-3 rounded-[var(--radius-md)] border border-line p-3 text-sm hover:bg-surface-2">
                  <ExternalLink size={18} aria-hidden className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t('scam.mule')}</span>
                    <span className="block text-muted">{r.phones.length ? t('scam.muleNumbers', { numbers: r.phones.join(', ') }) : t('scam.muleBody')}</span>
                  </span>
                </a>
                <a href="tel:997" className="pressable flex items-center gap-3 rounded-[var(--radius-md)] border border-line p-3 text-sm hover:bg-surface-2">
                  <Phone size={18} aria-hidden className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t('scam.nsrc')}</span>
                    <span className="block text-muted">{t('scam.nsrcBody')}</span>
                  </span>
                </a>
              </div>
              <p className="text-[0.8125rem] text-muted">{t(r.usedAi ? 'scam.usedAi' : 'scam.rulesOnly')}</p>
            </section>
          )
        })()}
      </div>
    </>
  )
}
