import type { ReactNode } from 'react'

// Desktop: a main column and a side column of related content (3 : 2), so wide screens are used, not left empty.
// Phones: one column in source order (each .col is display: contents there, see index.css).
export function Columns({ children }: { children: ReactNode }) {
  return <div className="contents lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6">{children}</div>
}
