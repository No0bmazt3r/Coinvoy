/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // The router plugin must run before react() so it can generate src/routeTree.gen.ts.
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  // Same origin as the API (ADR-1): the session cookie works with no CORS. xfwd passes the client IP on.
  server: { proxy: { '/api': { target: 'http://localhost:8000', xfwd: true } } },
})
