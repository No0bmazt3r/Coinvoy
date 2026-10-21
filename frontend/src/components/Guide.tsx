// Screen guides (Oct 2026 grilling): help the rider pulls up, not a tour pushed at sign-in (NN/g: upfront tutorials
// don't improve success). Each main screen has a ? button for a short tour, and a one-time hint card on the first
// visit. Tours only point at things, 2–4 steps, and skip any step whose target isn't on screen. Built on driver.js.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { CircleHelp, Lightbulb, X } from 'lucide-react'
import { useRef } from 'react'
import { useI18n, type Key } from '../i18n/t'
import { api, meQuery, type User } from '../lib/api'
import { type GuideScreen, STEPS, visibleTargets } from '../lib/guide'
import { Tooltip } from './Tooltip'

function useTips(screen: GuideScreen) {
  const queryClient = useQueryClient()
  return (action: 'seen' | 'started' | 'completed' | 'skipped') =>
    api<{ user: User }>('/api/tips', { body: { screen, action } })
      .then(({ user }) => queryClient.setQueryData(meQuery.queryKey, user))
      .catch(() => {}) // a missed log never blocks the tour
}

function useTour(screen: GuideScreen) {
  const { t } = useI18n()
  const tip = useTips(screen)
  return (returnFocus?: HTMLElement | null) => {
    const found = visibleTargets(STEPS[screen])
    if (!found.length) return
    const steps: DriveStep[] = found.map(({ target, el }, i) => ({
      element: el,
      popover: {
        title: t(`guide.${screen}.${target}.title` as Key),
        description: t(`guide.${screen}.${target}.body` as Key),
        side: 'bottom', // under the item where it fits (desktop); phones dock it to an edge instead
        align: 'start',
        showButtons: i === 0 ? ['next', 'close'] : ['next', 'previous', 'close'], // nothing to go back to on step 1
      },
    }))
    let finished = false
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const tour = driver({
      steps,
      animate: !reduced,
      smoothScroll: !reduced,
      allowClose: true,
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 12,
      disableActiveInteraction: true, // the tour only points; the rider acts after it
      showProgress: steps.length > 1,
      progressText: t('guide.progress'),
      nextBtnText: t('guide.next'),
      prevBtnText: t('guide.back'),
      doneBtnText: t('guide.done'),
      popoverClass: 'coinvoy-guide',
      onPopoverRender: (popover, { state }) => {
        // A labelled dialog for screen readers; on phones the card docks to the edge away from the highlighted item
        popover.wrapper.setAttribute('role', 'dialog')
        popover.wrapper.setAttribute('aria-modal', 'true')
        popover.title.id = 'coinvoy-guide-title'
        popover.wrapper.setAttribute('aria-labelledby', 'coinvoy-guide-title')
        popover.closeButton.setAttribute('aria-label', t('guide.skip'))
        const rect = state.activeElement?.getBoundingClientRect()
        const phone = !matchMedia('(min-width: 64rem)').matches
        popover.wrapper.classList.toggle('guide-dock-top', phone && !!rect && rect.top + rect.height / 2 > innerHeight / 2)
        popover.wrapper.classList.toggle('guide-dock-bottom', phone && !!rect && rect.top + rect.height / 2 <= innerHeight / 2)
      },
      onNextClick: (_el, _step, { driver: d }) => {
        if (!d.hasNextStep()) finished = true
        d.moveNext()
      },
      onDestroyed: () => {
        void tip(finished ? 'completed' : 'skipped')
        returnFocus?.focus()
      },
    })
    void tip('started')
    tour.drive()
  }
}

/** The ? in a screen's header: this screen's tour, any time. */
export function GuideButton({ screen }: { screen: GuideScreen }) {
  const { t } = useI18n()
  const start = useTour(screen)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <Tooltip side="bottom" text={t('guide.button')}><button ref={ref} type="button" aria-label={t('guide.button')} onClick={() => start(ref.current)} className="pressable grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text">
      <CircleHelp size={22} aria-hidden />
    </button></Tooltip>
  )
}

/** The one-time card on a screen's first visit: in the page, covering nothing. ✕ or the tour retires it for good. */
export function GuideHint({ screen }: { screen: GuideScreen }) {
  const { t } = useI18n()
  const { data: user } = useQuery(meQuery)
  const start = useTour(screen)
  const tip = useTips(screen)
  if (!user || user.seenTips.includes(screen)) return null
  return (
    <aside aria-label={t('guide.button')} className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3">
      <Lightbulb size={20} aria-hidden className="mt-0.5 shrink-0 text-muted" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <p className="text-sm">{t(`guide.hint.${screen}` as Key)}</p>
        <button type="button" onClick={() => start()} className="btn-ghost text-sm font-semibold">{t('guide.show')}</button>
      </div>
      <button type="button" aria-label={t('common.close')} onClick={() => void tip('seen')} className="pressable -m-1 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
        <X size={18} aria-hidden />
      </button>
    </aside>
  )
}
