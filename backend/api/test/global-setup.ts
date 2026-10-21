import { type ChildProcess, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ML_DIR = fileURLToPath(new URL('../../ml', import.meta.url))
let ml: ChildProcess

export async function setup() {
  ml = spawn('uv', ['run', 'uvicorn', 'app.service:app', '--port', '8011', '--log-level', 'warning'], {
    cwd: ML_DIR,
    env: { ...process.env, ML_TOKEN: 'test-token' },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch('http://127.0.0.1:8011/health')).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('ML service did not start')
}

export async function teardown() {
  ml?.kill()
}
