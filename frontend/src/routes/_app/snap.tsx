import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Camera, FileText, ImagePlus, Loader2, PencilLine, Plus, ScanLine, ShieldAlert, Trash2, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { MoneyField } from '../../components/MoneyField'
import { ResultPlaceholder } from '../../components/EmptyState'
import { GuideButton, GuideHint } from '../../components/Guide'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Select } from '../../components/Select'
import { useI18n, type Key } from '../../i18n/t'
import { ApiError, PLATFORMS, api, errorText, type Draft, type Platform } from '../../lib/api'
import { addDays, todayKL, weekLabel, weekStart } from '../../lib/dates'
import { shrink } from '../../lib/image'
import { formatRM } from '../../lib/money'
import { Tooltip } from '../../components/Tooltip'

type Mode = 'snap' | 'history' | 'manual'

export const Route = createFileRoute('/_app/snap')({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } =>
    s.mode === 'history' || s.mode === 'manual' || s.mode === 'snap' ? { mode: s.mode } : {},
  component: Snap,
})

const lastWeek = () => addDays(weekStart(todayKL()), -7)
const IMAGES = 'image/png,image/jpeg,image/webp'
const PDF = 'application/pdf'
type Source = 'camera' | 'gallery' | 'pdf' | 'any'
type Row = Draft & { key: number }
let nextKey = 0
const keyed = (d: Draft): Row => ({ ...d, key: nextKey++ })

// Snap → reading → editable drafts → confirm (FR-SNAP-1/2/3/5, FR-ONB-5). Nothing is saved before "Sahkan".
function Snap() {
  const { t, lang } = useI18n()
  const { user } = Route.useRouteContext()
  const { mode = 'snap' } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const blank = (week = lastWeek()): Row => ({
    key: nextKey++,
    weekStart: week, platform: user.platforms[0] ?? 'grab', grossSen: 0, commissionSen: 0, incentivesSen: 0, tipsSen: 0, trips: null, hoursOnline: null,
  })
  const [drafts, setDrafts] = useState<Row[]>(() => (mode === 'manual' ? [blank()] : []))
  const [notice, setNotice] = useState<string | null>(null)
  const aiAllowed = user.consents.llm_processing?.granted !== false
  // One hidden file input, set up for whichever button was tapped: the camera straight away, the photo gallery, or PDFs
  // (earnings statements the apps email). "Add more" takes any of them.
  const pick = (source: Source) => {
    const input = fileRef.current
    if (!input) return
    input.accept = source === 'camera' || source === 'gallery' ? IMAGES : source === 'pdf' ? PDF : `${IMAGES},${PDF}`
    input.multiple = source !== 'camera'
    if (source === 'camera') input.setAttribute('capture', 'environment')
    else input.removeAttribute('capture')
    input.click()
  }

  const read = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData()
      for (const f of files.slice(0, 5)) {
        if (f.type === PDF) form.append('files', f, f.name) // read as text on the server; nothing to shrink
        else form.append('files', await shrink(f), f.name.replace(/\.\w+$/, '.jpg'))
      }
      return api<{ drafts: Draft[]; notEarnings: number }>('/api/snap/extract', { form })
    },
    onSuccess: (res) => {
      setDrafts((cur) => [...cur, ...res.drafts.map(keyed)])
      setNotice(res.notEarnings ? t('snap.notEarnings', { n: res.notEarnings }) : res.drafts.length ? null : t('snap.nothingRead'))
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.code === 'llm_unconfigured' || e.code === 'llm_budget')) setDrafts((cur) => (cur.length ? cur : [blank()]))
    },
  })

  const confirm = useMutation({
    mutationFn: () => {
      const byWeek = new Map<string, Draft[]>()
      for (const d of drafts) byWeek.set(d.weekStart, [...(byWeek.get(d.weekStart) ?? []), d])
      const source = mode === 'history' ? 'history' : drafts.some((d) => d.confidence) ? 'snap' : 'manual'
      return api('/api/weeks/confirm', {
        body: {
          weeks: [...byWeek].map(([weekStart, rows]) => ({
            weekStart,
            platforms: rows.map(({ platform, grossSen, commissionSen, incentivesSen, tipsSen, trips, hoursOnline, confidence }) => ({
              platform, grossSen, commissionSen, incentivesSen, tipsSen, trips, hoursOnline, source, extractionConfidence: confidence ?? null,
            })),
          })),
        },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries() // home shows its skeleton or last numbers while the new salary loads
      void navigate({ to: '/' })
    },
  })

  const update = (i: number, patch: Partial<Draft>) => setDrafts((cur) => cur.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const dupes = new Set(drafts.map((d) => `${d.weekStart}:${d.platform}`)).size !== drafts.length
  const valid = drafts.length > 0 && drafts.every((d) => d.grossSen > 0) && !dupes

  return (
    <>
      <ScreenHeader title={t(mode === 'history' ? 'snap.historyTitle' : 'snap.title')} back action={<GuideButton screen="snap" />} />
      <GuideHint screen="snap" />
      <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        {drafts.length === 0 && !read.isPending && (
          <section className="flex flex-col gap-3 rounded-lg border-2 border-outline bg-surface p-5">
            <p className="text-muted">{t(mode === 'history' ? 'snap.historyBody' : 'snap.body')}</p>
            {aiAllowed ? (
              <>
                <button type="button" data-tour="camera" className="btn btn-brand" onClick={() => pick('camera')}>
                  <Camera size={20} aria-hidden />
                  {t('snap.camera')}
                </button>
                <div data-tour="files" className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn btn-secondary px-3" onClick={() => pick('gallery')}>
                    <ImagePlus size={20} aria-hidden />
                    {t('snap.gallery')}
                  </button>
                  <button type="button" className="btn btn-secondary px-3" onClick={() => pick('pdf')}>
                    <FileText size={20} aria-hidden />
                    {t('snap.pdf')}
                  </button>
                </div>
                <p className="text-[0.8125rem] text-muted">{t('snap.privacy')}</p>
              </>
            ) : (
              <p className="text-sm">{t('snap.aiOff')}</p>
            )}
            <button type="button" data-tour="manual" className="btn btn-secondary" onClick={() => setDrafts([blank()])}>
              <PencilLine size={20} aria-hidden />
              {t('snap.manual')}
            </button>
          </section>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={`${IMAGES},${PDF}`}
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) read.mutate(files)
          }}
        />
        {drafts.length === 0 && <ResultPlaceholder icon={ScanLine} body={t('snap.draftsHere')} />}
        {read.isPending && (
          <section aria-live="polite" className="flex items-center gap-3 rounded-lg border border-line bg-surface p-5">
            <Loader2 size={22} className="spin" aria-hidden />
            <span className="font-semibold">{t('snap.reading')}</span>
          </section>
        )}
        {(read.isError || notice) && (
          <p role="alert" className="rounded-[var(--radius-sm)] bg-[var(--careful-bg)] p-3 text-sm text-[var(--careful)] lg:col-span-full">
            {read.isError ? errorText(read.error, lang, t('snap.failed')) : notice}
          </p>
        )}
        {drafts.map((d, i) => (
          <DraftCard key={d.key} draft={d} onChange={(p) => update(i, p)} onRemove={() => setDrafts((cur) => cur.filter((_, j) => j !== i))} />
        ))}
        {drafts.length > 0 && (
          <div className="flex flex-col gap-4 lg:col-span-full">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setDrafts((cur) => [...cur, blank(cur.at(-1)?.weekStart)])}>
                <Plus size={18} aria-hidden />
                {t('snap.addPlatform')}
              </button>
              {aiAllowed && (
                <button type="button" className="btn btn-secondary" onClick={() => pick('any')} disabled={read.isPending}>
                  <ImagePlus size={18} aria-hidden />
                  {t('snap.addScreenshot')}
                </button>
              )}
            </div>
            {dupes && <p className="text-sm font-semibold text-[var(--risky)]">{t('snap.duplicate')}</p>}
            {confirm.isError && (
              <p role="alert" className="text-sm font-semibold text-[var(--risky)]">
                {errorText(confirm.error, lang, t('common.tryAgain'))}
              </p>
            )}
            <button type="button" className="btn btn-brand" disabled={!valid || confirm.isPending} onClick={() => confirm.mutate()}>
              {t('snap.confirm', { n: new Set(drafts.map((d) => d.weekStart)).size })}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

const WARNINGS: Record<string, Key> = {
  gross_high: 'snap.warn.grossHigh',
  hours_high: 'snap.warn.hoursHigh',
  trips_vs_hours: 'snap.warn.tripsHours',
  fare_odd: 'snap.warn.fareOdd',
  date_future: 'snap.warn.dateFuture',
}

function DraftCard({ draft: d, onChange, onRemove }: { draft: Draft; onChange: (p: Partial<Draft>) => void; onRemove: () => void }) {
  const { t, lang } = useI18n()
  const weeks = Array.from({ length: 26 }, (_, i) => addDays(weekStart(todayKL()), -7 * i))
  const net = d.grossSen - d.commissionSen + d.incentivesSen + d.tipsSen
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Select label={t('snap.platform')} hideLabel compact value={d.platform} onChange={(v: Platform) => onChange({ platform: v })} options={PLATFORMS.map((p) => ({ value: p, label: t(`platform.${p}` as Key) }))} />
        </div>
        <div className="min-w-0 flex-1">
          <Select label={t('snap.week')} hideLabel compact value={d.weekStart} onChange={(v) => onChange({ weekStart: v })} options={(weeks.includes(d.weekStart) ? weeks : [d.weekStart, ...weeks]).map((w) => ({ value: w, label: weekLabel(w, lang) }))} />
        </div>
        <Tooltip side="bottom" text={t('common.delete')}><button type="button" onClick={onRemove} aria-label={t('common.delete')} className="pressable grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2">
          <Trash2 size={20} aria-hidden />
        </button></Tooltip>
      </div>
      {d.injectionSuspected && (
        <p className="flex gap-2 rounded-[var(--radius-sm)] bg-[var(--risky-bg)] p-3 text-sm text-[var(--risky)]">
          <ShieldAlert size={18} className="shrink-0" aria-hidden />
          {t('snap.injection')}
        </p>
      )}
      {d.warnings?.map((w) => (
        <p key={w} className="flex gap-2 rounded-[var(--radius-sm)] bg-[var(--careful-bg)] p-3 text-sm text-[var(--careful)]">
          <TriangleAlert size={18} className="shrink-0" aria-hidden />
          {t(WARNINGS[w] ?? 'snap.warn.generic')}
        </p>
      ))}
      <MoneyField label={t('snap.gross')} valueSen={d.grossSen || null} onChange={(v) => onChange({ grossSen: v ?? 0 })} required />
      <div className="grid grid-cols-2 gap-3">
        <MoneyField label={t('snap.commission')} valueSen={d.commissionSen || null} onChange={(v) => onChange({ commissionSen: v ?? 0 })} />
        <MoneyField label={t('snap.incentives')} valueSen={d.incentivesSen || null} onChange={(v) => onChange({ incentivesSen: v ?? 0 })} />
        <MoneyField label={t('snap.tips')} valueSen={d.tipsSen || null} onChange={(v) => onChange({ tipsSen: v ?? 0 })} />
        <NumberField label={t('snap.hours')} value={d.hoursOnline} max={168} step={0.5} onChange={(v) => onChange({ hoursOnline: v })} />
        <NumberField label={t('snap.trips')} value={d.trips} max={2000} step={1} onChange={(v) => onChange({ trips: v })} />
      </div>
      <p className="flex justify-between border-t border-line pt-3 text-sm">
        <span className="text-muted">{t('snap.net')}</span>
        <b className="tabular-nums">{formatRM(net)}</b>
      </p>
      <p className="text-[0.8125rem] text-muted">{t(d.confidence ? 'snap.fromScreenshot' : 'source.self')}</p>
    </section>
  )
}

function NumberField({ label, value, onChange, max, step }: { label: string; value: number | null; onChange: (v: number | null) => void; max: number; step: number }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.min(max, Math.max(0, Number(e.target.value))))}
        className="h-12 rounded-[var(--radius-sm)] border border-line-strong bg-surface-2 px-3 text-base font-normal tabular-nums"
      />
    </label>
  )
}
