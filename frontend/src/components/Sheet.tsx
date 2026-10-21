import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/t'

const EXIT_MS = 220 // matches .sheet.closing in index.css

// Bottom sheet (a centred dialog on desktop) on the native <dialog>: showModal() traps focus, Esc closes it, and the page behind goes inert.
// It slides up on open and back down on close; the content stays mounted until the exit has played.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
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
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose() }} // Esc: play the exit instead of vanishing
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 sm:mx-auto sm:max-w-[480px] lg:my-auto"
    >
      <div className="rounded-t-[var(--radius-lg)] border border-b-0 border-line bg-surface px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-text shadow-[0_-8px_24px_rgb(0_0_0/0.12)] lg:rounded-[var(--radius-lg)] lg:border-b lg:px-6 lg:pt-5 lg:pb-6">
        <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-strong lg:hidden" />
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-xl font-bold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="pressable -mr-2 grid size-11 place-items-center rounded-full hover:bg-surface-2">
            <X size={22} aria-hidden />
          </button>
        </div>
        {open ? children : closing && kept}
      </div>
    </dialog>
  )
}
