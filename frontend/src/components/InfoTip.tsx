import { Info } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/t'

// A tap-to-open explanation of a money word ("Commission: the cut the app takes…"). Unlike Tooltip it works on
// touch screens: tap or click the ⓘ to open, tap anywhere else, scroll or press Esc to close.
// Safe inside a <label>: tapping the button doesn't jump to the field. Inside a sheet it's drawn in the sheet, since an
// open <dialog> sits above everything else on the page.
export function InfoTip({ term, text }: { term: string; text: string }) {
  const { t } = useI18n()
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ x: number; y: number; host: Element } | null>(null)

  const toggle = () => {
    if (at) return setAt(null)
    const r = button.current!.getBoundingClientRect()
    setAt({ x: Math.max(12, Math.min(innerWidth - 268, r.left + r.width / 2 - 128)), y: r.bottom + 8, host: button.current!.closest('dialog') ?? document.body })
  }

  useEffect(() => {
    if (!at) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !button.current?.contains(e.target as Node)) setAt(null)
    }
    const hide = () => setAt(null)
    addEventListener('pointerdown', close)
    addEventListener('keydown', close)
    addEventListener('scroll', hide, true)
    return () => {
      removeEventListener('pointerdown', close)
      removeEventListener('keydown', close)
      removeEventListener('scroll', hide, true)
    }
  }, [at])

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={(e) => {
          e.preventDefault() // inside a <label>, don't focus the field
          toggle()
        }}
        aria-label={t('term.whatIs', { term })}
        aria-expanded={at !== null}
        aria-controls={at ? id : undefined}
        className="relative -my-2 inline-grid size-6 shrink-0 place-items-center rounded-full align-middle text-muted after:absolute after:-inset-2 hover:text-text"
      >
        <Info size={15} aria-hidden />
      </button>
      {at &&
        createPortal(
          <div id={id} role="note" className="fixed z-[60] w-64 rounded-[var(--radius-md)] bg-ink px-3 py-2.5 text-sm leading-snug font-normal text-on-ink shadow-[0_8px_24px_rgb(0_0_0/0.25)]" style={{ left: at.x, top: at.y }}>
            <b className="font-semibold">{term}</b>
            <span className="text-on-ink-muted"> · </span>
            {text}
          </div>,
          at.host,
        )}
    </>
  )
}
