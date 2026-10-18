import { createApp } from './app.ts'
import { migrate } from './db/index.ts'
import { env, googleConfigured } from './env.ts'

await migrate()
if (!googleConfigured()) console.warn('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set: Google sign-in is off, the demo login still works.')
createApp().listen(env.PORT, () => console.log(`api listening on :${env.PORT}`))
