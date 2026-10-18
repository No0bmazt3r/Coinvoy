import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../i18n/t'
import { api } from '../lib/api'

const ANSWERS = ['ya', 'hampir', 'tak_cukup'] as const

// One tap a week: "Did you have enough money last week?" The answers are Coinvoy's measured impact (FR-GAJI-5, G1).
export function CheckinCard({ weekStart }: { weekStart: string }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const answer = useMutation({
    mutationFn: (a: (typeof ANSWERS)[number]) => api('/api/checkins', { body: { weekStart, answer: a } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.invalidateQueries({ queryKey: ['streak'] })
    },
  })
  return (
    <section aria-labelledby="checkin" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 id="checkin" className="font-semibold">
        {t('checkin.question')}
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {ANSWERS.map((a) => (
          <button key={a} type="button" disabled={answer.isPending} onClick={() => answer.mutate(a)} className="btn btn-secondary px-2">
            {t(`checkin.${a}`)}
          </button>
        ))}
      </div>
    </section>
  )
}
