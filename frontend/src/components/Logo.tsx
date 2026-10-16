// Two files because the logo's ink strokes disappear on dark backgrounds; index.css picks one per theme.
export function Logo({ className = '', onDark = false }: { className?: string; onDark?: boolean }) {
  if (onDark) return <img src="/logo-dark.png" alt="Coinvoy" className={className} />
  return (
    <>
      <img src="/logo.png" alt="Coinvoy" className={`logo-light ${className}`} />
      <img src="/logo-dark.png" alt="Coinvoy" className={`logo-dark ${className}`} />
    </>
  )
}
