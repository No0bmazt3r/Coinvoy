import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

// Small hand-made SVG charts. Colours come from the --chart-* and --c-* tokens, so they follow the theme.
// Hover (mouse), tap (touch) or the arrow keys show a card with the exact numbers,
// and screen readers get a plain table with the same numbers instead of the picture.

export type TipRow = { color?: string; line?: boolean; label: string; value: string }
export type Tip = { title: string; rows: TipRow[] }

const AXIS_W = 44
const X_BAND = 22

/** The container's width, kept up to date. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e!.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** A round axis with up to 4 steps of 1, 2, 2.5 or 5 times a power of ten, just above the biggest value. */
function scale(v: number) {
  const raw = Math.max(v, 1) / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw && Number.isInteger(s))!) // counts never get half steps
  const max = Math.ceil(Math.max(v, 1) / step) * step
  return { max, ticks: Array.from({ length: max / step + 1 }, (_, i) => i * step) }
}

/** A bar with a 4px rounded data end and a square foot on the baseline. */
const bar = (x: number, y: number, w: number, h: number, round: boolean) => {
  const r = round ? Math.min(4, w / 2, h) : 0
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function TipCard({ tip, x, width }: { tip: Tip; x: number; width: number }) {
  const left = Math.max(0, Math.min(width - 224, x - 112))
  return (
    <div role="presentation" className="pointer-events-none absolute top-0 z-10 w-56 rounded-[var(--radius-sm)] bg-ink px-2.5 py-2 text-[0.8125rem] leading-snug text-on-ink shadow-[0_6px_20px_rgb(0_0_0/0.25)]" style={{ left }}>
      <p className="text-on-ink-muted">{tip.title}</p>
      {tip.rows.map((r) => (
        <p key={r.label} className="flex items-center gap-1.5">
          {r.color && <span aria-hidden className={r.line ? 'h-0.5 w-3 shrink-0 rounded-full' : 'size-2 shrink-0 rounded-[2px]'} style={{ background: r.color }} />}
          <b className="tabular-nums">{r.value}</b>
          <span className="min-w-0 truncate text-on-ink-muted">{r.label}</span>
        </p>
      ))}
    </div>
  )
}

/** The same numbers as the chart, for screen readers. */
function SrTable({ caption, tips }: { caption: string; tips: Tip[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {tips.map((tip) => (
          <tr key={tip.title}>
            <th scope="row">{tip.title}</th>
            {tip.rows.map((r) => <td key={r.label}>{r.label}: {r.value}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Which point is picked: the mouse position, a tap, or the arrow keys. */
function usePick(n: number, onSelect?: (i: number) => void) {
  const [active, setActive] = useState<number | null>(null)
  const key = (e: KeyboardEvent) => {
    const i = active ?? n
    if (e.key === 'ArrowRight') setActive(Math.min(n - 1, i + (active === null ? 0 : 1)))
    else if (e.key === 'ArrowLeft') setActive(Math.max(0, i - 1))
    else if (e.key === 'Escape') setActive(null)
    else if (e.key === 'Enter' && active !== null && onSelect) onSelect(active)
    else return
    e.preventDefault()
  }
  return { active, setActive, key }
}

type Frame = { summary: string; tips: Tip[]; height?: number; children?: ReactNode }

/**
 * Columns, stacked when a column has several parts. `line` draws one flat reference line (the salary on Gaji).
 * `onSelect` makes each column a button (Rekod opens that week's payslip).
 */
export function BarChart({ cols, line, format, onSelect, summary, tips, height = 160 }: Frame & {
  cols: { label: string; parts: { color: string; value: number }[] }[]
  line?: { value: number; color: string }
  format: (v: number) => string
  onSelect?: (i: number) => void
}) {
  const [ref, width] = useWidth()
  const { active, setActive, key } = usePick(cols.length, onSelect)
  const top = 12
  const plotH = height - X_BAND - top
  const plotW = Math.max(0, width - AXIS_W)
  const { max, ticks } = scale(Math.max(line?.value ?? 0, ...cols.map((c) => c.parts.reduce((a, p) => a + p.value, 0))))
  const y = (v: number) => top + plotH - (v / max) * plotH
  const band = cols.length ? plotW / cols.length : 0
  const bw = Math.min(24, band * 0.7)
  const every = Math.ceil(cols.length / Math.max(1, Math.floor(plotW / 56))) // keep x labels from touching
  const move = (e: PointerEvent<SVGRectElement>, i: number) => e.pointerType === 'mouse' && setActive(i)
  return (
    <div ref={ref} className="relative" onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={summary} tabIndex={0} onKeyDown={key} onBlur={() => setActive(null)} className="block overflow-visible rounded-[var(--radius-sm)]">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={AXIS_W} x2={width} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={AXIS_W - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[0.6875rem] tabular-nums">{format(v)}</text>
            </g>
          ))}
          {cols.map((c, i) => {
            const x = AXIS_W + i * band + (band - bw) / 2
            let acc = 0
            const visible = c.parts.filter((p) => p.value > 0)
            return (
              <g key={c.label + i} opacity={active === null || active === i ? 1 : 0.55}>
                {visible.map((p, j) => {
                  const y0 = y(acc)
                  acc += p.value
                  const y1 = y(acc)
                  const gap = j < visible.length - 1 ? 2 : 0 // the 2px surface gap between stacked parts
                  return <path key={j} d={bar(x, y1 + gap, bw, Math.max(0, y0 - y1 - gap), j === visible.length - 1)} fill={p.color} />
                })}
                {i % every === (cols.length - 1) % every && (
                  <text x={x + bw / 2} y={height - 6} textAnchor="middle" className="fill-muted text-[0.6875rem]">{c.label}</text>
                )}
                <rect
                  x={AXIS_W + i * band} y={top} width={band} height={plotH} fill="transparent"
                  onPointerEnter={(e) => move(e, i)} onPointerMove={(e) => move(e, i)}
                  onPointerDown={(e) => e.pointerType !== 'mouse' && setActive(i)}
                  onClick={() => onSelect?.(i)}
                  className={onSelect ? 'cursor-pointer' : undefined}
                />
              </g>
            )
          })}
          {line && <line x1={AXIS_W} x2={width} y1={y(line.value)} y2={y(line.value)} stroke={line.color} strokeWidth={2} strokeLinecap="round" pointerEvents="none" />}
        </svg>
      )}
      {active !== null && tips[active] && <TipCard tip={tips[active]} x={AXIS_W + (active + 0.5) * band} width={width} />}
      <SrTable caption={summary} tips={tips} />
    </div>
  )
}

/** One line with a soft fill under it. `target` is a dashed goal line. The last value is labelled at the end. */
export function LineChart({ values, labels, color, target, format, summary, tips, height = 120 }: Frame & {
  values: number[]
  labels: string[]
  color: string
  target?: number
  format: (v: number) => string
}) {
  const [ref, width] = useWidth()
  const { active, setActive, key } = usePick(values.length)
  const top = 12
  const right = 12
  const plotH = height - X_BAND - top
  const plotW = Math.max(0, width - AXIS_W - right)
  const { max, ticks } = scale(Math.max(target ?? 0, ...values))
  const y = (v: number) => top + plotH - (v / max) * plotH
  const x = (i: number) => AXIS_W + (values.length > 1 ? (i / (values.length - 1)) * plotW : plotW / 2)
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' L')
  const pick = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (values.length - 1))
    setActive(Math.max(0, Math.min(values.length - 1, i)))
  }
  const every = Math.ceil(values.length / Math.max(1, Math.floor(plotW / 64)))
  const shown = active ?? values.length - 1
  return (
    <div ref={ref} className="relative" onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}>
      {width > 0 && values.length > 0 && (
        <svg width={width} height={height} role="img" aria-label={summary} tabIndex={0} onKeyDown={key} onBlur={() => setActive(null)} className="block overflow-visible rounded-[var(--radius-sm)]">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={AXIS_W} x2={width - right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={AXIS_W - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[0.6875rem] tabular-nums">{format(v)}</text>
            </g>
          ))}
          <path d={`M${x(0)},${y(0)} L${pts} L${x(values.length - 1)},${y(0)}Z`} fill={color} opacity={0.1} />
          {target !== undefined && target > 0 && <line x1={AXIS_W} x2={width - right} y1={y(target)} y2={y(target)} stroke="var(--border-strong)" strokeWidth={1.5} strokeDasharray="4 4" />}
          <path d={`M${pts}`} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {labels.map((l, i) => i % every === (labels.length - 1) % every && (
            <text key={l + i} x={x(i)} y={height - 6} textAnchor={i === 0 && labels.length > 1 ? 'start' : i === labels.length - 1 && labels.length > 1 ? 'end' : 'middle'} className="fill-muted text-[0.6875rem]">{l}</text>
          ))}
          {active !== null && <line x1={x(active)} x2={x(active)} y1={top} y2={top + plotH} stroke="var(--border-strong)" strokeWidth={1} />}
          <circle cx={x(shown)} cy={y(values[shown]!)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
          <rect x={AXIS_W} y={top} width={plotW} height={plotH} fill="transparent" onPointerMove={pick} onPointerDown={pick} />
        </svg>
      )}
      {active !== null && tips[active] && <TipCard tip={tips[active]} x={x(active)} width={width} />}
      <SrTable caption={summary} tips={tips} />
    </div>
  )
}

/**
 * Horizontal bars, longest first, each labelled with its value (so no hover is needed).
 * `part` fills a darker share of the bar (the guide funnel: finished out of started).
 */
export function HBars({ rows, color, summary }: { rows: { label: string; value: number; part?: number; text: string }[]; color: string; summary: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul aria-label={summary} className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted">{r.text}</span>
          </span>
          <span aria-hidden className="block h-2 rounded-full bg-surface-2">
            <span className="relative block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.part === undefined ? color : 'var(--chart-bar)' }}>
              {r.part !== undefined && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${r.value ? (r.part / r.value) * 100 : 0}%`, background: color }} />}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** A legend row: a swatch per series (a logo when given), so colour is never the only clue. */
export function Legend({ items }: { items: { color: string; label: string; icon?: string; line?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.icon ? (
            <span aria-hidden className="grid size-4 place-items-center rounded-[4px]" style={{ background: it.color }}><img src={it.icon} alt="" width={11} height={11} className="size-[11px]" /></span>
          ) : (
            <span aria-hidden className={it.line ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-[3px]'} style={{ background: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  )
}
