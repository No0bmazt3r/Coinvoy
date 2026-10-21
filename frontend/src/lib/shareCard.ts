// The streak share card: the week count, the level and the logo. Never an RM amount.
type Card = { weeks: number; weeksLabel: string; level: string; tagline: string; accent: string }

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null) // the card still works without the logo
    img.src = src
  })
}

export async function streakCard({ weeks, weeksLabel, level, tagline, accent }: Card): Promise<Blob> {
  const size = 1080
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#1D1E1D'
  g.fillRect(0, 0, size, size)
  g.textAlign = 'center'
  g.textBaseline = 'middle'

  g.fillStyle = accent
  g.beginPath()
  g.arc(size / 2, 400, 230, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#1D1E1D'
  g.font = `800 ${weeks > 99 ? 170 : 230}px ${FONT}`
  g.fillText(String(weeks), size / 2, 410)

  g.fillStyle = '#FFFFFF'
  g.font = `700 68px ${FONT}`
  g.fillText(weeksLabel, size / 2, 720)
  g.fillStyle = accent
  g.font = `600 50px ${FONT}`
  g.fillText(level, size / 2, 805)

  const logo = await loadImage('/logo.png')
  if (logo) g.drawImage(logo, size / 2 - 230, 905, 90, 90 * (logo.height / logo.width))
  g.textAlign = 'left'
  g.fillStyle = '#FFFFFF'
  g.font = `800 48px ${FONT}`
  g.fillText('Coinvoy', size / 2 - 120, 935)
  g.fillStyle = '#B8BAB4'
  g.font = `500 30px ${FONT}`
  g.fillText(tagline, size / 2 - 120, 985, 460)

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'))
}

/** The phone's share sheet when it can share images, otherwise a download. */
export async function shareImage(blob: Blob, text: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], 'coinvoy-streak.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared' // the rider closed the sheet
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  return 'downloaded'
}
