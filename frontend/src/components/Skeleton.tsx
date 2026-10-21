// Plain blocks; the pulse is switched off under reduced motion (index.css).
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-lg bg-surface-2 ${className}`} />
}

// A generic screen: header, a big card, two rows.
export function RouteSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4 py-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-48" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  )
}
