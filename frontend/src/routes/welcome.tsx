import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  BadgeCheck,
  CalendarHeart,
  FileText,
  HandCoins,
  Landmark,
  MessageCircle,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LangToggle } from '../components/LangToggle'
import { Logo } from '../components/Logo'
import { useI18n, type Key } from '../i18n/t'
import { markIntroSeen } from '../lib/intro'

export const Route = createFileRoute('/welcome')({ component: Welcome })

const PERKS: { icon: LucideIcon; label: Key }[] = [
  { icon: Wallet, label: 'intro.perk1' },
  { icon: FileText, label: 'intro.perk2' },
  { icon: Landmark, label: 'intro.perk3' },
  { icon: CalendarHeart, label: 'intro.perk4' },
  { icon: MessageCircle, label: 'intro.perk5' },
]
const TRUST: Key[] = ['intro.trust1', 'intro.trust2', 'intro.trust3']
// Weekly earnings as a share of the best week: the uneven bars the steady line smooths over.
const WEEKS = [0.9, 0.42, 0.75, 0.3, 1, 0.55]
// Desktop side padding grows with the window, so the slides use the full width at any size
const GUTTER = 'lg:px-[clamp(2.5rem,6vw,8rem)]'

// First launch: swipe (native scroll-snap) or tap Next through four slides, then on to login.
function Welcome() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const slides: { title: Key; body: Key; art: ReactNode }[] = [
    { title: 'intro.s1Title', body: 'intro.s1Body', art: <Logo className="intro-float h-[132px] w-auto" /> },
    {
      title: 'intro.s2Title',
      body: 'intro.s2Body',
      art: (
        <div className="relative flex h-40 w-64 items-end justify-between gap-2 rounded-lg bg-white/5 px-5 pt-4 pb-5" aria-hidden>
          {WEEKS.map((h, i) => (
            <span
              key={i}
              className="intro-bar w-6 rounded-t-md bg-on-ink-muted/40"
              style={{ height: `${h * 100}%`, animationDelay: `${i * 60}ms` }}
            />
          ))}
          <span className="intro-line absolute inset-x-4 bottom-[45%] border-t-[3px] border-dashed border-brand" />
          <span className="absolute right-4 bottom-[calc(45%+0.4rem)] rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-bold text-on-brand">
            {t('intro.s2Steady')}
          </span>
        </div>
      ),
    },
    {
      title: 'intro.s3Title',
      body: 'intro.s3Body',
      art: (
        <ul className="flex w-full max-w-xs flex-col gap-2 text-left">
          {PERKS.map(({ icon: Icon, label }, i) => (
            <li key={label} className="intro-rise flex items-center gap-3 rounded-md bg-white/5 px-3 py-2.5" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-on-brand">
                <Icon size={17} aria-hidden />
              </span>
              <span className="text-sm font-semibold">{t(label)}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: 'intro.s4Title',
      body: 'intro.s4Body',
      art: (
        <div className="flex flex-col items-center gap-4">
          <span className="intro-pop grid size-24 place-items-center rounded-full bg-brand text-on-brand">
            <ShieldCheck size={48} strokeWidth={1.75} aria-hidden />
          </span>
          <ul className="flex flex-col gap-2 text-left">
            {TRUST.map((label, i) => (
              <li key={label} className="intro-rise flex items-center gap-2 text-sm font-semibold" style={{ animationDelay: `${120 + i * 70}ms` }}>
                <BadgeCheck size={18} className="text-brand" aria-hidden />
                {t(label)}
              </li>
            ))}
          </ul>
        </div>
      ),
    },
  ]
  const last = index === slides.length - 1

  const goTo = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' })
  const finish = () => {
    markIntroSeen()
    void navigate({ to: '/login', replace: true })
  }
  // Keyboard users (and desktop, where there's no swipe) step through with the arrow keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') track.current?.scrollBy({ left: track.current.clientWidth, behavior: 'smooth' })
      if (e.key === 'ArrowLeft') track.current?.scrollBy({ left: -track.current.clientWidth, behavior: 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    // Desktop: the whole page, with the words on the left, the art large on the right, and every slide's title in the step bar
    <main
      aria-label={t('intro.label')}
      className="mx-auto flex h-dvh max-w-[480px] flex-col overflow-hidden bg-ink pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-on-ink lg:max-w-none lg:pb-10"
    >
      <div className={`flex items-center justify-between gap-3 px-4 pt-3 lg:justify-end lg:pt-6 ${GUTTER}`}>
        <span className="mr-auto hidden items-center gap-2 lg:flex">
          <Logo className="h-9 w-auto" />
          <span className="text-xl font-extrabold tracking-tight">Coinvoy</span>
        </span>
        <LangToggle />
        <button type="button" onClick={finish} className={`pressable min-h-11 px-3 text-sm font-semibold text-on-ink-muted ${last ? 'invisible' : ''}`}>
          {t('intro.skip')}
        </button>
      </div>

      <div
        ref={track}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {slides.map((s, i) => (
          <section
            key={s.title}
            aria-hidden={i !== index}
            className={`flex w-full shrink-0 snap-center flex-col items-center justify-center gap-8 px-6 text-center lg:grid lg:grid-cols-2 lg:gap-[clamp(3rem,6vw,8rem)] lg:text-left ${GUTTER} ${i === index ? 'intro-active' : ''}`}
          >
            <div className="intro-art grid min-h-48 w-full place-items-center lg:order-2 lg:h-full lg:max-h-[75dvh] lg:rounded-[40px] lg:bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand)_16%,transparent),transparent)]">
              {/* scale (not transform) so it stacks with the float/pop animations; on the children so the track never widens */}
              <div className="flex w-full justify-center lg:*:scale-150 xl:*:scale-[1.75] 2xl:*:scale-200">{s.art}</div>
            </div>
            <div className="flex flex-col gap-3 lg:gap-5">
              <p className="intro-rise hidden text-sm font-bold tracking-widest text-brand lg:block">
                {String(i + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
              </p>
              <h1 className="intro-rise text-[1.75rem] leading-tight font-extrabold tracking-tight lg:text-[clamp(3rem,4.2vw,5.5rem)] lg:leading-[1.05]">{t(s.title)}</h1>
              <p className="intro-rise mx-auto max-w-sm text-on-ink-muted [animation-delay:80ms] lg:mx-0 lg:max-w-[min(40rem,100%)] lg:text-[clamp(1.125rem,1.25vw,1.5rem)]">{t(s.body)}</p>
            </div>
          </section>
        ))}
      </div>

      <div className={`flex flex-col items-center gap-6 px-4 pt-4 lg:flex-row lg:items-end lg:gap-12 ${GUTTER}`}>
        <div className="flex gap-2 lg:hidden">
          {slides.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={t('intro.goTo', { n: i + 1 })}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => goTo(i)}
              className="grid h-6 place-items-center"
            >
              <span
                className={`block h-2 rounded-full transition-all duration-300 ease-[var(--ease-out)] ${i === index ? 'w-6 bg-brand' : 'w-2 bg-white/25'}`}
              />
            </button>
          ))}
        </div>
        <ol className="hidden flex-1 grid-cols-4 gap-6 lg:grid">
          {slides.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                aria-current={i === index ? 'step' : undefined}
                onClick={() => goTo(i)}
                className={`flex w-full flex-col gap-2 text-left text-sm transition-colors duration-200 hover:text-on-ink ${i === index ? 'text-on-ink' : 'text-on-ink-muted'}`}
              >
                <span className={`block h-1 rounded-full transition-colors duration-300 ${i <= index ? 'bg-brand' : 'bg-white/15'}`} />
                <span className="font-bold tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <span className="line-clamp-2 font-semibold">{t(s.title)}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => (last ? finish() : goTo(index + 1))} className="btn btn-primary lg:w-auto lg:min-w-52 lg:px-8">
          {t(last ? 'intro.start' : 'intro.next')}
          {last ? <HandCoins size={20} aria-hidden /> : <ArrowRight size={20} aria-hidden />}
        </button>
      </div>
    </main>
  )
}
