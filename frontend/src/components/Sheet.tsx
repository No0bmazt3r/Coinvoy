import { X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useI18n } from '../i18n/t'

const EXIT_MS = 220 // matches .sheet.closing in index.css
const DISMISS_PX = 120 // drag the sheet down this far, or flick it, and it closes
const FLICK = 0.6 // px/ms

// A bottom sheet on phones and a centred dialog on desktop, built on the browser's <dialog>.
// It slides up to open and down to close, and keeps its content on screen until the close animation ends.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null)
  // Closing starts when `open` turns false (adjusted during render, React's pattern for reacting to a prop) and ends
  // after the exit animation. The last content stays on screen meanwhile, even if the parent already cleared it.
  const [closing, setClosing] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  const [kept, setKept] = useState<ReactNode>(null)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) setClosing(true)
  }
  if (open && kept !== children) setKept(children)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.classList.remove('closing')
      panel.current?.style.removeProperty('transform') // a previous drag-to-close leaves it moved
      panel.current?.style.removeProperty('transition')
      d.showModal()
    }
    if (!open && d.open) {
      const finish = () => { d.classList.remove('closing'); d.close(); setClosing(false) }
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finish()
      d.classList.add('closing')
      const id = setTimeout(finish, EXIT_MS)
      return () => clearTimeout(id)
    }
  }, [open])
  // On phones you can drag the sheet down by its handle or title. Let go far enough (or flick it) and it closes,
  // otherwise it springs back.
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button') || matchMedia('(min-width: 64rem)').matches) return
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
    panel.current?.style.setProperty('transition', 'none')
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = drag.current
    if (!g) return
    const dy = e.clientY - g.y
    g.dy = dy > 0 ? dy : dy / 4 // upward only stretches a little
    panel.current?.style.setProperty('transform', `translateY(${g.dy}px)`)
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = drag.current
    drag.current = null
    if (!g || !panel.current) return
    if (g.dy > DISMISS_PX || g.dy / Math.max(1, e.timeStamp - g.t) > FLICK) return onClose()
    panel.current.style.setProperty('transition', 'transform 250ms var(--ease-out)')
    panel.current.style.removeProperty('transform')
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose() }} // Esc: play the exit instead of vanishing
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      data-no-swipe // touches here are for the sheet, not the page's tab swipe behind it
      className="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 sm:mx-auto sm:max-w-[480px] lg:my-auto"
    >
      <div ref={panel} className="rounded-t-[var(--radius-lg)] border border-b-0 border-line bg-surface px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-text shadow-[0_-8px_24px_rgb(0_0_0/0.12)] lg:rounded-[var(--radius-lg)] lg:border-b lg:px-6 lg:pt-5 lg:pb-6">
        {/* The grab area: handle and title. touch-none so the drag isn't taken as a page scroll. */}
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className="-mx-4 -mt-2 touch-none px-4 pt-2 lg:mx-0 lg:mt-0 lg:touch-auto lg:px-0 lg:pt-0">
          <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-strong lg:hidden" />
          <div className="mb-3 flex items-center gap-2">
            <h2 className="flex-1 text-xl font-bold tracking-tight">{title}</h2>
            <button type="button" onClick={onClose} aria-label={t('common.close')} className="pressable -mr-2 grid size-11 place-items-center rounded-full hover:bg-surface-2">
              <X size={22} aria-hidden />
            </button>
          </div>
        </div>
        {open ? children : closing && kept}
      </div>
    </dialog>
  )
}
