// One file for both themes: the ink strokes are recoloured olive so they show on dark backgrounds too.
export function Logo({ className = '' }: { className?: string }) {
  return <img src="/logo.png" alt="Coinvoy" className={className} />
}
