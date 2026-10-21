import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach } from 'vitest'
import { db, migrate } from '../src/db/index.ts'
import { env } from '../src/env.ts'
import { provider } from '../src/llm/client.ts'

// Tests only ever run on throwaway databases: in-memory PGlite or the CI Postgres. Never the developer's backend/api/.pglite.
if (env.DATABASE_URL !== 'memory://' && !env.DATABASE_URL.startsWith('postgres')) {
  throw new Error(`Tests refuse DATABASE_URL="${env.DATABASE_URL}": use memory:// or a test Postgres (TEST_DATABASE_URL)`)
}

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
