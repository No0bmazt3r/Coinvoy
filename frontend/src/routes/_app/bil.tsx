import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { MoneyField } from '../../components/MoneyField'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Sheet } from '../../components/Sheet'
import { Skeleton } from '../../components/Skeleton'
import { Select } from '../../components/Select'
import { useI18n, type Key } from '../../i18n/t'
import { api, type Bill, billsQuery, errorText } from '../../lib/api'
import { formatRM } from '../../lib/money'

export const Route = createFileRoute('/_app/bil')({ component: Bills })

const FREQS: Bill['frequency'][] = ['monthly', 'weekly', 'yearly', 'once']
const DAYS: Key[] = ['day.0', 'day.1', 'day.2', 'day.3', 'day.4', 'day.5', 'day.6']

// The bills calendar (FR-ONB-4): bills are inside the simulation, so adding one changes the salary straight away.
function Bills() {
  const { t } = useI18n()
  const q = useQuery(billsQuery)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/bills/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const due = (b: Bill) =>
    b.frequency === 'monthly' ? t('bills.dueMonthly', { day: b.dueDay ?? 1 }) : b.frequency === 'weekly' ? t('bills.dueWeekly', { day: t(DAYS[b.dueDay ?? 0]!) }) : t(b.frequency === 'yearly' ? 'bills.dueYearly' : 'bills.dueOnce', { date: b.dueDate ?? '' })
  return (
    <>
      <ScreenHeader title={t('bills.title')} back />
      <p className="text-muted">{t('bills.body')}</p>
      {q.isPending ? (
        <Skeleton className="h-40" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <section className="rounded-lg border border-line bg-surface">
          <EmptyState icon={CalendarClock} body={t('bills.empty')} />
        </section>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {q.data.map((b) => (
            <li key={b.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{b.name}</p>
                <p className="text-sm text-muted">{due(b)}</p>
              </div>
              <b className="tabular-nums">{formatRM(b.amountSen)}</b>
              <button type="button" aria-label={t('common.delete')} onClick={() => remove.mutate(b.id)} className="pressable grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2">
                <Trash2 size={20} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus size={20} aria-hidden />
        {t('bills.add')}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('bills.add')}>
        <BillForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  )
}

function BillForm({ onDone }: { onDone: () => void }) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [frequency, setFrequency] = useState<Bill['frequency']>('monthly')
  const [dueDay, setDueDay] = useState(1)
  const [dueDate, setDueDate] = useState('')
  const save = useMutation({
    mutationFn: () =>
      api('/api/bills', {
        body: { name, amountSen: amount, frequency, dueDay: frequency === 'monthly' || frequency === 'weekly' ? dueDay : null, dueDate: frequency === 'yearly' || frequency === 'once' ? dueDate : null },
      }),
    onSuccess: () => {
      onDone() // close at once; the lists refresh in the background
      void queryClient.invalidateQueries()
    },
  })
  const valid = name.trim() && amount && (frequency === 'monthly' || frequency === 'weekly' || dueDate)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) save.mutate()
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t('bills.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('bills.namePlaceholder')} maxLength={60} className="h-12 rounded-[var(--radius-sm)] border border-line-strong bg-surface-2 px-3 text-base font-normal" />
      </label>
      <MoneyField label={t('bills.amount')} valueSen={amount} onChange={setAmount} required />
      <Select label={t('bills.frequency')} value={frequency} onChange={setFrequency} options={FREQS.map((f) => ({ value: f, label: t(`bills.freq.${f}` as Key) }))} />
      {frequency === 'monthly' && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('bills.dueDay')}
          <input type="number" inputMode="numeric" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))} className="h-12 rounded-[var(--radius-sm)] border border-line-strong bg-surface-2 px-3 text-base font-normal tabular-nums" />
        </label>
      )}
      {frequency === 'weekly' && (
        <Select label={t('bills.dueWeekday')} value={dueDay} onChange={setDueDay} options={DAYS.map((d, i) => ({ value: i, label: t(d) }))} />
      )}
      {(frequency === 'yearly' || frequency === 'once') && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('bills.dueDate')}
          <input type="date" lang={lang} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-12 rounded-[var(--radius-sm)] border border-line-strong bg-surface-2 px-3 text-base font-normal" />
        </label>
      )}
      {save.isError && <p role="alert" className="text-sm font-semibold text-[var(--risky)]">{errorText(save.error, lang, t('common.tryAgain'))}</p>}
      <button type="submit" className="btn btn-primary" disabled={!valid || save.isPending}>
        {t('common.save')}
      </button>
    </form>
  )
}
