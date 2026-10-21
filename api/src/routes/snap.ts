// POST /api/snap/extract: screenshots in, drafts out. Nothing is saved until /api/weeks/confirm (FR-SNAP-2).
import { Router } from 'express'
import multer from 'multer'
import { requireUser, userOf } from '../auth.ts'
import { db } from '../db/index.ts'
import { ApiError } from '../errors.ts'
import { cleanImage, drafts, extract, isPdf, MAX_BYTES } from '../llm/snap.ts'
import { checkQuota, logUsage } from '../llm/usage.ts'
import { ml } from '../ml.ts'
import { platformsOf } from '../services/salary.ts'

const MAX_FILES = 5
// Memory only: screenshots never touch the disk or the database (FR-SNAP-4).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES + 1, files: MAX_FILES + 1 } })

const scannedPdf = () =>
  new ApiError(422, 'pdf_no_text', 'PDF ini gambar imbasan, tiada teks untuk dibaca. Ambil gambar skrin pendapatan anda.', "This PDF is a scan with no text to read. Take a screenshot of your earnings instead.")

async function pdfText(raw: Buffer): Promise<string> {
  if (raw.length > MAX_BYTES) throw new ApiError(413, 'image_too_big', 'Fail terlalu besar (had 5 MB).', 'File too large (5 MB max).')
  const lines = await ml.statementLines(raw).catch((err: unknown) => {
    if (err instanceof ApiError && err.code === 'statement_unreadable') // broken or password-protected; an outage stays an outage
      throw new ApiError(422, 'pdf_unreadable', 'PDF ini tak dapat dibaca. Cuba PDF lain (tanpa kata laluan) atau gambar skrin.', "This PDF can't be read. Try another PDF (no password) or a screenshot.")
    throw err
  })
  if (lines.length === 0) throw scannedPdf()
  return lines.join('\n')
}

export const snapRouter = Router()

snapRouter.post('/snap/extract', requireUser, (req, res, next) => {
  upload.array('files')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(
        err.code === 'LIMIT_FILE_SIZE'
          ? new ApiError(413, 'image_too_big', 'Fail terlalu besar (had 5 MB).', 'File too large (5 MB max).')
          : new ApiError(422, 'too_many_images', 'Pilih 1 hingga 5 fail.', 'Choose 1 to 5 files.'),
      )
    } else next(err)
  })
}, async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (files.length < 1 || files.length > MAX_FILES) throw new ApiError(422, 'too_many_images', 'Pilih 1 hingga 5 fail.', 'Choose 1 to 5 files.')
  const user = userOf(res)
  // Screenshots and photos are re-encoded (refusing anything that isn't a real image); PDFs become their text via the
  // ML service, in memory. Both happen before any AI call, so a bad file costs no tokens.
  const images = await Promise.all(files.map(async (f) => (isPdf(f.buffer) ? { pdfText: await pdfText(f.buffer) } : cleanImage(f.buffer))))
  await checkQuota(user.id, 'snap', images.length)
  const platforms = await platformsOf(db, user.id)
  const rows = []
  let notEarnings = 0
  for (const image of images) {
    const { out, call } = await extract(image, platforms)
    if (call) await logUsage(user.id, 'snap', call)
    if (!out.is_earnings_screen) notEarnings++
    rows.push(...drafts(out, platforms[0] ?? 'other'))
  }
  res.json({ drafts: rows, notEarnings })
})
