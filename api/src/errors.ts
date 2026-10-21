import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { errorFields, log } from './log.ts'

// Errors reach the client as { error: { code, message_ms, message_en } }.
export class ApiError extends Error {
  status: number
  code: string
  messageMs: string
  constructor(status: number, code: string, messageMs: string, messageEn: string) {
    super(messageEn)
    this.status = status
    this.code = code
    this.messageMs = messageMs
  }
}

export const notFound = () => new ApiError(404, 'not_found', 'Tidak dijumpai.', 'Not found.')

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message_ms: err.messageMs, message_en: err.message } })
    return
  }
  if (err instanceof ZodError) {
    const where = err.issues.map((i) => i.path.join('.') || 'body').join(', ')
    res.status(422).json({ error: { code: 'invalid', message_ms: `Maklumat tidak sah: ${where}`, message_en: `Invalid input: ${where}` } })
    return
  }
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(err.status ?? 400).json({ error: { code: 'bad_body', message_ms: 'Permintaan tidak sah.', message_en: 'Bad request.' } })
    return
  }
  log('error', 'unhandled', { method: req.method, path: req.path, ...errorFields(err) })
  res.status(500).json({ error: { code: 'server', message_ms: 'Ralat pelayan. Cuba lagi.', message_en: 'Server error. Try again.' } })
}
