import { defineConfig } from 'drizzle-kit'

// `pnpm --filter coinvoy-api db:generate` writes SQL migrations to api/drizzle from src/db/schema.ts.
export default defineConfig({ dialect: 'postgresql', schema: './src/db/schema.ts', out: './drizzle' })
