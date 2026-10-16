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
