import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Sheet } from './Sheet'

export type Option<T> = { value: T; label: string; hint?: string }

// A dropdown that opens the app's bottom sheet (a centred dialog on desktop): big rows a thumb can hit, the current
// choice ticked and focused, Esc or a tap outside to close. Replaces <select>, whose native list looks different on
// every phone and can't be styled.
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  compact = false,
}: {
  label: string
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  hideLabel?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const list = useRef<HTMLUListElement>(null)
  // Once the sheet is open, bring the current choice into view inside the list only. Scrolling it into view with
  // scrollIntoView (or a plain focus) while the sheet is still sliding up made the whole sheet jump.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      const ul = list.current
      const on = ul?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      if (!ul || !on) return
      ul.scrollTop = on.offsetTop - ul.clientHeight / 2 + on.offsetHeight / 2
      on.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [open])
  const current = options.find((o) => o.value === value)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {!hideLabel && <span id={id} className="text-sm font-semibold">{label}</span>}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-labelledby={hideLabel ? undefined : `${id} ${id}-v`}
        aria-label={hideLabel ? `${label}: ${current?.label ?? ''}` : undefined}
        onClick={() => setOpen(true)}
        className={`pressable flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-line-strong bg-surface-2 text-left hover:border-text ${compact ? 'h-11 px-3 text-sm font-semibold' : 'h-12 px-3.5 text-base'}`}
      >
        <span id={`${id}-v`} className="min-w-0 flex-1 truncate">{current?.label}</span>
        <ChevronDown size={18} aria-hidden className="shrink-0 text-muted" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <ul ref={list} className="relative -mx-2 flex max-h-[60dvh] flex-col overflow-y-auto overscroll-contain">
          {options.map((o) => {
            const on = o.value === value
            return (
              <li key={String(o.value)}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className={`pressable flex min-h-13 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left hover:bg-surface-2 ${on ? 'bg-surface-2 font-semibold' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{o.label}</span>
                    {o.hint && <span className="block text-[0.8125rem] font-normal text-muted">{o.hint}</span>}
                  </span>
                  {on && <Check size={20} aria-hidden className="shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>
    </div>
  )
}
