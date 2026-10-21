import type { ReactNode } from 'react'

// Two columns on desktop (main and side), one column on phones.
export function Columns({ children }: { children: ReactNode }) {
  return <div className="contents lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6">{children}</div>
}
