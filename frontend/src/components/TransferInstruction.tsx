import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { MoneyField } from './MoneyField'
import { Sheet } from './Sheet'
import { useI18n, type Key } from '../i18n/t'
import { api, type Transfer } from '../lib/api'
import { formatRM } from '../lib/money'

// FR-GAJI-2/3: one instruction a week. The buffer only counts what the rider confirms here.
export function TransferInstruction({ transfer: tr }: { transfer: Transfer }) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const [partialOpen, setPartialOpen] = useState(false)
  const [partial, setPartial] = useState<number | null>(null)
  const confirm = useMutation({
    mutationFn: (amountSen: number | null) => api(`/api/transfers/${tr.id}/confirm`, { body: { amountSen } }),
    onSuccess: () => {
      navigator.vibrate?.(10)
      setPartialOpen(false)
      queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.invalidateQueries({ queryKey: ['pots'] })
    },
  })

  const into = tr.direction === 'in'
  const Icon = into ? ArrowDownToLine : ArrowUpFromLine
  const parts = Object.entries(tr.allocation).filter(([k, v]) => k !== 'penampan' && v !== 0)
  const pot = !into && (tr.allocation.cuti ?? 0) < 0 && !tr.allocation.penampan ? 'cuti' : 'penampan'
  const amount = formatRM(tr.amountSen, { whole: true })
  const done = tr.status === 'confirmed' || tr.status === 'partial'
  const time = tr.confirmedAt
    ? new Intl.DateTimeFormat(lang === 'ms' ? 'ms-MY' : 'en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(tr.confirmedAt))
    : ''

  return (
    <div data-tour="transfer" className={`m-2 mt-0 flex flex-col gap-3 rounded-[var(--radius-md)] bg-surface p-4 text-text ${done ? '' : 'border-2 border-dashed border-line-strong'}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">
          <Icon size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t(into ? 'transfer.in' : 'transfer.out', { amount, pot: t(`pot.${pot}` as Key) })}</p>
          {parts.length > 0 && (
            <p className="text-sm text-muted">
              {t('transfer.includes', {
                list: parts.map(([k, v]) => `${formatRM(Math.abs(v), { whole: true })} ${t(`pot.${k}` as Key)}`).join(', '),
              })}
            </p>
          )}
          <p className="mt-1 text-[0.8125rem] text-muted">
            {done
              ? tr.status === 'partial'
                ? t('transfer.partialDone', { done: formatRM(tr.confirmedAmountSen ?? 0, { whole: true }), amount })
                : t('transfer.done', { time })
              : t('transfer.pending')}
            {' · '}
            {t(tr.verification === 'checked' ? 'source.checked' : 'source.self')}
          </p>
        </div>
        {done && <CircleCheck size={22} className="shrink-0 text-[var(--safe)]" aria-hidden />}
      </div>
      {tr.status !== 'confirmed' && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-brand px-3" disabled={confirm.isPending} onClick={() => confirm.mutate(null)}>
            {t(into ? 'transfer.confirm' : 'transfer.confirmOut')}
          </button>
          <button type="button" className="btn btn-secondary px-3" onClick={() => setPartialOpen(true)}>
            {t('transfer.partial')}
          </button>
        </div>
      )}
      {confirm.isError && (
        <p role="alert" className="text-sm font-semibold text-[var(--risky)]">
          {t('common.tryAgain')}
        </p>
      )}
      <Sheet open={partialOpen} onClose={() => setPartialOpen(false)} title={t('transfer.partialTitle')}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (partial !== null) confirm.mutate(partial)
          }}
        >
          <MoneyField label={t('transfer.partialLabel')} valueSen={null} onChange={setPartial} required autoFocus hint={t('transfer.partialHint', { amount })} />
          <button type="submit" className="btn btn-primary" disabled={partial === null || confirm.isPending}>
            {t('common.save')}
          </button>
        </form>
      </Sheet>
    </div>
  )
}
