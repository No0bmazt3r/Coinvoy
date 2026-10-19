import { createApp } from './app.ts'
import { migrate } from './db/index.ts'
import { env, googleConfigured } from './env.ts'
import { log } from './log.ts'
import { startReminders } from './services/reminders.ts'

await migrate()
if (!googleConfigured()) log('warn', 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set: Google sign-in is off, the demo login still works.')
createApp().listen(env.PORT, () => log('info', 'api listening', { port: env.PORT }))
startReminders()
