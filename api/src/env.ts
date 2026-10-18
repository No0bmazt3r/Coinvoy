import { z } from 'zod'

// Fails fast on a bad environment (GOOGLE_AUTH_PORTABLE.md §4). One .env at the repo root; real env vars win.
const bool = (fallback: boolean) => z.stringbool().default(fallback)
const schema = z.object({
  PORT: z.coerce.number().default(8000),
  // Empty = embedded Postgres (PGlite) in api/.pglite, zero setup. 'memory://' for tests. postgres://… in production.
  DATABASE_URL: z.string().default(''),
  APP_URL: z.url().default('http://localhost:5173'),
  COOKIE_SECURE: bool(false),
  SESSION_TTL_DAYS: z.coerce.number().positive().default(7),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  DEMO_ENABLED: bool(true),
  // The Python ML service (engine, BM classifier, Penyata renderer)
  ML_URL: z.url().default('http://127.0.0.1:8001'),
  ML_TOKEN: z.string().default(''),
  // Any OpenAI-compatible LLM provider (see .env.example). Empty key = AI off, manual entry still works.
  LLM_BASE_URL: z.url().default('https://openrouter.ai/api/v1'),
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default(''),
  LLM_MODEL_SNAP: z.string().default(''),
  LLM_MODEL_TANYA: z.string().default(''),
  LLM_MODEL_LENDER: z.string().default(''),
  LLM_MODEL_BM: z.string().default(''),
  LLM_TIMEOUT_S: z.coerce.number().default(60),
  LLM_DAILY_SNAP: z.coerce.number().default(15),
  LLM_DAILY_TANYA: z.coerce.number().default(20),
  LLM_DAILY_LENDER: z.coerce.number().default(5),
  LLM_DAILY_BM: z.coerce.number().default(30),
  LLM_MONTHLY_CALL_CAP: z.coerce.number().default(20_000),
  LLM_PROVIDER_NAME: z.string().default(''),
  LLM_REGION_NOTE: z.string().default(''),
  DEMO_LLM_CACHE: bool(false),
  BM_CLASSIFIER_THRESHOLD: z.coerce.number().default(0.7),
  // Contributions (FR-CAR-*). VERIFY each against the official source before the pitch.
  ISARAAN_MATCH_RATE: z.coerce.number().default(0.2),
  ISARAAN_MATCH_CAP_SEN: z.coerce.number().default(50_000),
  PERKESO_RATE: z.coerce.number().default(0.0125),
  PERKESO_DEDUCTED_AT_SOURCE: bool(true),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment (see .env.example):\n' + z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
export const googleConfigured = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
export const llmConfigured = () => Boolean(env.LLM_API_KEY && env.LLM_MODEL)
