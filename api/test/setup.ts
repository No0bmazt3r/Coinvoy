import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach } from 'vitest'
import { db, migrate } from '../src/db/index.ts'
import { env } from '../src/env.ts'
import { provider } from '../src/llm/client.ts'

beforeAll(async () => {
  await migrate()
})

beforeEach(async () => {
  provider.client = null
  Object.assign(env, { LLM_API_KEY: '', LLM_MODEL: '', LLM_MODEL_SNAP: '' }) // tests that fake an LLM set these
  const result = (await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '%drizzle%'`)) as unknown as { rows: { tablename: string }[] }
  const rows = result.rows
  await db.execute(sql.raw(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`))
})
