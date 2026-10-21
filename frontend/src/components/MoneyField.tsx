import { useId, useState } from 'react'
import { formatRM, parseRM } from '../lib/money'
import { useI18n } from '../i18n/t'
import { InfoTip } from './InfoTip'

// RM prefix, decimal keypad, tabular figures, error as text under the field.
export function MoneyField({
  label,
  valueSen,
  onChange,
  hint,
  info,
  required = false,
  autoFocus = false,
}: {
  label: string
  valueSen: number | null
  onChange: (sen: number | null) => void
  hint?: string
  info?: string // a plain-words explanation of the label, behind an ⓘ
  required?: boolean
  autoFocus?: boolean
}) {
  const { t } = useI18n()
  const id = useId()
  const [text, setText] = useState(valueSen === null ? '' : formatRM(valueSen).slice(2).replace(/,/g, ''))
  const parsed = parseRM(text)
  const error = text && parsed === null ? t('form.badAmount') : required && !text ? t('form.required') : null
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {info && <InfoTip term={label} text={info} />}
      </span>
      {/* One ring around the whole field (RM and the number), not a second one around the input inside it */}
      <div className={`flex h-12 items-center rounded-[var(--radius-md)] border bg-surface-2 transition-colors focus-within:border-text focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus ${error ? 'border-[var(--risky)]' : 'border-line-strong hover:border-text'}`}>
        <span className="pl-3.5 text-sm font-semibold text-muted">RM</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          value={text}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          onChange={(e) => {
            const typed = e.target.value.replace(/[^\d.,]/g, '') // a desktop keyboard can type letters; amounts never have them
            setText(typed)
            const v = typed ? parseRM(typed) : null
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
