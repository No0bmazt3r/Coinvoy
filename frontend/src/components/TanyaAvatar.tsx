import { BotAvatar } from 'bot-avatars'

// Tanya's face: a lime Coinvoy coin with a milled edge, in glossy plastic. It hops while it works on an answer.
// The outline: a circle with 30 small ridges round the rim, in the library's 100×100 body box.
const COIN = (() => {
  const n = 30
  const pts = Array.from({ length: n * 4 }, (_, i) => {
    const a = (2 * Math.PI * i) / (n * 4) - Math.PI / 2
    const r = 41 + 1.6 * Math.cos(n * a)
    return `${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`
  })
  return `M${pts.join('L')}Z`
})()

export function TanyaAvatar({ size = 40, busy = false }: { size?: number; busy?: boolean }) {
  return <BotAvatar type="circle" path={COIN} color="#B5FC04" face="mouth" shading="plastic" state={busy ? 'working' : 'default'} size={size} aria-hidden />
}
