import { useId, useState } from 'react'
import { formatRM, parseRM } from '../lib/money'
import { useI18n } from '../i18n/t'

// RM prefix, decimal keypad, tabular figures, error as text under the field (design-system §6.5).
export function MoneyField({
  label,
  valueSen,
  onChange,
  hint,
  required = false,
  autoFocus = false,
}: {
  label: string
  valueSen: number | null
  onChange: (sen: number | null) => void
  hint?: string
  required?: boolean
  autoFocus?: boolean
}) {
  const { t } = useI18n()
  const id = useId()
  const [text, setText] = useState(valueSen === null ? '' : formatRM(valueSen).slice(2).replace(/,/g, ''))
  const parsed = parseRM(text)
  const error = text && parsed === null ? t('form.badAmount') : required && !text ? t('form.required') : null
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="flex h-12 items-center rounded-[var(--radius-sm)] border border-line-strong bg-surface-2 focus-within:outline-2 focus-within:outline-focus">
        <span className="pl-3 text-sm font-semibold text-muted">RM</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          value={text}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          onChange={(e) => {
            setText(e.target.value)
            const v = e.target.value ? parseRM(e.target.value) : null
            onChange(v)
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-base tabular-nums outline-none"
        />
      </div>
      {(error || hint) && (
        <p id={`${id}-msg`} className={`text-[0.8125rem] ${error ? 'font-semibold text-[var(--risky)]' : 'text-muted'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
