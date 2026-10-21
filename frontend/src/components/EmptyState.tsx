import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ icon: Icon, title, body, children }: { icon: LucideIcon; title?: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
      <span className="mb-1 grid size-16 place-items-center rounded-full bg-surface-2 text-text">
        <Icon size={30} strokeWidth={1.75} aria-hidden />
      </span>
      {title && <h2 className="text-xl font-bold tracking-tight">{title}</h2>}
      <p className="max-w-xs text-sm text-muted">{body}</p>
      {children}
    </div>
  )
}

// Desktop only: holds the second column of a form screen until there's a result to show.
export function ResultPlaceholder({ icon, body }: { icon: LucideIcon; body: string }) {
  return (
    <div className="hidden min-h-64 place-items-center rounded-lg border-2 border-dashed border-line lg:grid">
      <EmptyState icon={icon} body={body} />
    </div>
  )
}
