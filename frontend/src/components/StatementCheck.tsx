import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileCheck2, Loader2 } from 'lucide-react'
import { useRef } from 'react'
import { useI18n } from '../i18n/t'
import { api, errorText } from '../lib/api'

// Upload a bank statement to mark matching weeks as "Disemak silang". The PDF is never kept.
export function StatementCheck() {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const check = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api<{ weeksChecked: number; transfersChecked: number; entriesFound: number }>('/api/statement', { form })
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
  return (
    <section aria-labelledby="crosscheck" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 id="crosscheck" className="flex items-center gap-2 font-semibold"><FileCheck2 size={18} aria-hidden /> {t('statement.title')}</h2>
      <p className="text-sm text-muted">{t('statement.body')}</p>
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) check.mutate(f) }} />
      <button type="button" className="btn btn-secondary" disabled={check.isPending} onClick={() => input.current?.click()}>
        {check.isPending ? <Loader2 size={18} className="spin" aria-hidden /> : null}
        {t('statement.upload')}
      </button>
      {check.isSuccess && <p role="status" className="text-sm font-semibold">{t('statement.result', { weeks: check.data.weeksChecked, transfers: check.data.transfersChecked })}</p>}
      {check.isError && <p role="alert" className="text-sm text-[var(--risky)]">{errorText(check.error, lang, t('common.tryAgain'))}</p>}
    </section>
  )
}
