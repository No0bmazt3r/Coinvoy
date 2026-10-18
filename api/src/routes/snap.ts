// POST /api/snap/extract: screenshots in, drafts out. Nothing is saved until /api/weeks/confirm (FR-SNAP-2).
import { Router } from 'express'
import multer from 'multer'
import { requireUser, userOf } from '../auth.ts'
import { db } from '../db/index.ts'
import { ApiError } from '../errors.ts'
import { cleanImage, drafts, extract, MAX_BYTES } from '../llm/snap.ts'
import { checkQuota, logUsage } from '../llm/usage.ts'
import { platformsOf } from '../services/salary.ts'

const MAX_FILES = 5
// Memory only: screenshots never touch the disk or the database (FR-SNAP-4).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES + 1, files: MAX_FILES + 1 } })

export const snapRouter = Router()

snapRouter.post('/snap/extract', requireUser, (req, res, next) => {
  upload.array('files')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(
        err.code === 'LIMIT_FILE_SIZE'
          ? new ApiError(413, 'image_too_big', 'Gambar terlalu besar (had 5 MB).', 'Image too large (5 MB max).')
          : new ApiError(422, 'too_many_images', 'Pilih 1 hingga 5 gambar.', 'Choose 1 to 5 images.'),
      )
    } else next(err)
  })
}, async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (files.length < 1 || files.length > MAX_FILES) throw new ApiError(422, 'too_many_images', 'Pilih 1 hingga 5 gambar.', 'Choose 1 to 5 images.')
  const user = userOf(res)
  const images = await Promise.all(files.map((f) => cleanImage(f.buffer))) // refuse non-images before spending tokens
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
