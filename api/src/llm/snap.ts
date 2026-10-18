// Snap: an earnings screenshot → draft weeks for the rider to confirm (FR-SNAP-1, -4, -7, -11).
// The image is re-encoded in memory (which also strips EXIF), sent once, and dropped. Nothing is written anywhere.
// The model has no tools and must answer in a schema, so text inside an image can't make it do anything.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { z } from 'zod'
import { env } from '../env.ts'
import { ApiError } from '../errors.ts'
import { addWeeks, thisWeek, todayKL, weekStart } from '../lib/weeks.ts'
import { type ChatResult, chat, imagePart } from './client.ts'

const PROMPT = readFileSync(new URL('./prompts/snap.md', import.meta.url), 'utf8')
const PROMPT_VERSION = createHash('sha256').update(PROMPT).digest('hex').slice(0, 8)
const CACHE_DIR = fileURLToPath(new URL('../../.llm-cache', import.meta.url))
export const MAX_BYTES = 5 * 1024 * 1024
const MAX_EDGE = 1568
const WEEKLY_GROSS_SANE_RM = 10_000 // above this a weekly figure is a misread, not a rider's week
const PLATFORMS = ['grab', 'foodpanda', 'shopeefood', 'lalamove', 'other'] as const

const rm = z.number().min(0).nullable().default(null)
export const SnapWeek = z.object({
  platform: z.enum(PLATFORMS).nullable().default(null),
  week_start: z.iso.date().nullable().default(null),
  week_end: z.iso.date().nullable().default(null),
  gross_rm: rm,
  commission_rm: rm,
  incentives_rm: rm,
  tips_rm: rm,
  trips: z.number().int().min(0).nullable().default(null),
  hours_online: rm,
  confidence: z.enum(['high', 'medium', 'low']).default('low'),
  notes: z.string().nullable().default(null),
})
export const SnapOut = z.object({ is_earnings_screen: z.boolean(), weeks: z.array(SnapWeek).max(12).default([]) })
export type SnapOut = z.infer<typeof SnapOut>

/** Refuse anything that isn't a real JPEG/PNG/WebP, shrink it, and re-encode it (drops EXIF and metadata). */
export async function cleanImage(raw: Buffer): Promise<Buffer> {
  if (raw.length > MAX_BYTES) throw new ApiError(413, 'image_too_big', 'Gambar terlalu besar (had 5 MB).', 'Image too large (5 MB max).')
  try {
    const meta = await sharp(raw).metadata()
    if (!['jpeg', 'png', 'webp'].includes(meta.format ?? '')) throw new Error(meta.format)
    return await sharp(raw).rotate().resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
  } catch {
    throw new ApiError(415, 'not_an_image', 'Fail ini bukan gambar. Guna JPG atau PNG.', "That file isn't an image. Use JPG or PNG.")
  }
}

/** The model's answer, and the call (null when replayed from the demo cache, FR-DEMO-2). */
export async function extract(image: Buffer, platforms: string[]): Promise<{ out: SnapOut; call: ChatResult<SnapOut> | null }> {
  const key = createHash('sha256').update(image).update(PROMPT_VERSION).digest('hex')
  const cached = `${CACHE_DIR}/${key}.json`
  if (env.DEMO_LLM_CACHE && existsSync(cached)) return { out: SnapOut.parse(JSON.parse(readFileSync(cached, 'utf8'))), call: null }
  const system = PROMPT.replace('{year}', todayKL().slice(0, 4)).replace('{platforms}', platforms.join(', ') || 'unknown')
  const call = await chat(
    'snap',
    [
      { role: 'system', content: system },
      { role: 'user', content: [{ type: 'text', text: 'Read this earnings screenshot.' }, imagePart(image)] },
    ],
    { schema: SnapOut, maxTokens: 1200 },
  )
  if (env.DEMO_LLM_CACHE) {
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(cached, JSON.stringify(call.parsed))
  }
  return { out: call.parsed, call }
}

const sen = (v: number | null) => Math.round((v ?? 0) * 100)

/** Model answer → draft rows in sen, snapped to the week's Monday, with consistency warnings (FR-SNAP-7). */
export function drafts(out: SnapOut, defaultPlatform: string) {
  const lastWeek = addWeeks(thisWeek(), -1)
  return out.weeks.flatMap((w) => {
    if (w.gross_rm === null) return [] // no total visible: nothing to draft, the rider can type it
    let monday = weekStart(w.week_start ?? w.week_end ?? lastWeek)
    const warnings: string[] = []
    if (w.gross_rm > WEEKLY_GROSS_SANE_RM) warnings.push('gross_high')
    if (w.hours_online !== null && w.hours_online > 100) warnings.push('hours_high')
    if (w.trips && w.hours_online && w.trips > w.hours_online * 6) warnings.push('trips_vs_hours')
    if (w.trips && w.gross_rm && !(w.gross_rm / w.trips >= 2 && w.gross_rm / w.trips <= 60)) warnings.push('fare_odd')
    if (monday > thisWeek()) {
      monday = lastWeek
      warnings.push('date_future')
    }
    return [
      {
        weekStart: monday,
        platform: w.platform ?? defaultPlatform,
        grossSen: sen(w.gross_rm),
        commissionSen: sen(w.commission_rm),
        incentivesSen: sen(w.incentives_rm),
        tipsSen: sen(w.tips_rm),
        trips: w.trips,
        hoursOnline: w.hours_online,
        confidence: w.confidence,
        warnings,
        injectionSuspected: Boolean(w.notes?.toLowerCase().includes('instruction')),
      },
    ]
  })
}
