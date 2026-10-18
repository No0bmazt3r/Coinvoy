import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { env } from '../env.ts'
import * as schema from './schema.ts'

// Postgres everywhere: real Postgres in production, PGlite (Postgres compiled to WASM) locally and in tests,
// so there's one SQL dialect and no setup for a fresh clone.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url))
const DEFAULT_DIR = fileURLToPath(new URL('../../.pglite', import.meta.url))

function connect(): { db: Db; migrate: () => Promise<void>; close: () => Promise<void> } {
  if (env.DATABASE_URL.startsWith('postgres')) {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 })
    const db = drizzlePg(pool, { schema })
    return { db, migrate: () => migratePg(db, { migrationsFolder: MIGRATIONS }), close: () => pool.end() }
  }
  const client = new PGlite(env.DATABASE_URL === 'memory://' ? undefined : env.DATABASE_URL || DEFAULT_DIR)
  const db = drizzlePglite(client, { schema })
  return { db, migrate: () => migratePglite(db, { migrationsFolder: MIGRATIONS }), close: () => client.close() }
}

const conn = connect()
export const db = conn.db
export const migrate = conn.migrate
export const closeDb = conn.close
export { schema }
