import { createApp } from './app.ts'
import { closeDb, migrate, serveDb } from './db/index.ts'
import { env, googleConfigured } from './env.ts'
import { describeAi } from './llm/client.ts'
import { log } from './log.ts'
import { startReminders } from './services/reminders.ts'

await migrate()
if (serveDb && env.PGLITE_PORT) {
  await serveDb(env.PGLITE_PORT)
    .then((url) => log('info', 'local database open to Postgres clients (DBeaver, psql)', { url }))
    .catch((err) => log('warn', 'could not open the local database to Postgres clients', { port: env.PGLITE_PORT, err: String(err) }))
}
for (const line of describeAi()) log('info', `ai ${line}`)
if (!googleConfigured()) log('warn', 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set: Google sign-in is off, the demo login still works.')
const server = createApp().listen(env.PORT, () => log('info', 'api listening', { port: env.PORT }))
startReminders()

// Ctrl+C, node --watch restarts and Render deploys all stop the process with a signal: close the database first.
let stopping = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    if (stopping) return
    stopping = true
    server.close()
    server.closeAllConnections()
    await closeDb().catch((err) => log('error', 'db close failed', { err: String(err) }))
    process.exit(0)
  })
}
