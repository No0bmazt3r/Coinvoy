import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const DELAY_MS = 400 // sweeping the mouse across a list doesn't flash every tip

// A small ink tooltip for mouse and keyboard users (never touch: there's nothing to hover). Shows after a short hover,
// or at once on keyboard focus; Esc hides it. Drawn in a fixed layer on <body>, so a scrolling sidebar can't clip it.
// The wrapper is display: contents, so the trigger keeps its own layout, ref and handlers; events bubble up to it.
// `describes`: the tip adds information (linked with aria-describedby); otherwise it repeats the button's own
// accessible name (icon buttons), so screen readers aren't told it twice.
export function Tooltip({ text, side = 'right', describes = false, children }: { text: string; side?: 'right' | 'bottom'; describes?: boolean; children: ReactNode }) {
  const id = useId()
  const wrap = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const trigger = () => wrap.current?.firstElementChild as HTMLElement | null | undefined

  const show = (delay: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const r = trigger()?.getBoundingClientRect()
      if (r) setAt(side === 'right' ? { x: r.right + 10, y: r.top + r.height / 2 } : { x: r.left + r.width / 2, y: r.bottom + 10 })
    }, delay)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setAt(null)
  }

  useEffect(() => {
    if (!at) return
    const el = trigger()
    if (describes) el?.setAttribute('aria-describedby', id)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide()
    addEventListener('keydown', onKey)
    addEventListener('scroll', hide, true)
    return () => {
      if (describes) el?.removeAttribute('aria-describedby')
      removeEventListener('keydown', onKey)
      removeEventListener('scroll', hide, true)
    }
  }, [at, describes, id])
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <span
      ref={wrap}
      className="contents"
      onPointerEnter={(e) => e.pointerType === 'mouse' && show(DELAY_MS)}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && show(0)}
      onBlur={hide}
    >
      {children}
      {at &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            data-side={side}
            className={`tooltip pointer-events-none fixed z-[60] max-w-64 rounded-[var(--radius-sm)] bg-ink px-2.5 py-1.5 text-[0.8125rem] leading-snug font-medium text-on-ink shadow-[0_6px_20px_rgb(0_0_0/0.25)] ${side === 'right' ? '-translate-y-1/2' : '-translate-x-1/2'}`}
            style={{ left: at.x, top: at.y }}
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  )
}
