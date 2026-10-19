import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n/t'

// Bottom sheet (a centred dialog on desktop) on the native <dialog>: showModal() traps focus, Esc closes it, and the page behind goes inert.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
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
        {open && children}
      </div>
    </dialog>
  )
}
