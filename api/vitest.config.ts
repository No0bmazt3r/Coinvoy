import { defineConfig } from 'vitest/config'

// Tests run against the real Python ML service (started once in test/global-setup.ts) and an in-memory
// Postgres (PGlite) per worker, so the API and the engine can't drift apart.
export default defineConfig({
  test: {
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: 'memory://',
      ML_URL: 'http://127.0.0.1:8011',
      ML_TOKEN: 'test-token',
      APP_URL: 'http://localhost:5173',
      GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-secret',
      DEMO_ENABLED: 'true',
      AUTH_RATE_PER_MIN: '100000',
      LLM_API_KEY: '',
      LLM_MODEL: '',
    },
  },
})
