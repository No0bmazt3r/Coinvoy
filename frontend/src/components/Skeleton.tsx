// Plain blocks; the pulse is switched off under reduced motion (index.css).
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-lg bg-surface-2 ${className}`} />
}
