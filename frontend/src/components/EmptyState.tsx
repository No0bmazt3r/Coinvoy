import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ icon: Icon, title, body, children }: { icon: LucideIcon; title?: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <Icon size={48} strokeWidth={1.75} className="text-muted" aria-hidden />
      {title && <h2 className="text-xl font-bold">{title}</h2>}
      <p className="max-w-xs text-muted">{body}</p>
      {children}
    </div>
  )
}
