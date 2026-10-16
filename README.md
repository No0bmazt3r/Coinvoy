# Coinvoy

**Tiada majikan? Coinvoy beri apa yang majikan beri.** A PWA that gives Malaysian gig riders what an employer gives (a steady weekly salary, payslips, contributions, paid leave and an advisor) using only their own money. UTP CodeFest '26, Track 5: Finance.

## Run it

You need Node 24 with [pnpm](https://pnpm.io), and Python 3.12 with [uv](https://docs.astral.sh/uv/).

```bash
pnpm bootstrap          # installs the frontend and backend, creates the local SQLite DB
cp .env.example .env    # optional: add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET for Google sign-in
pnpm dev                # API on :8000 + app on http://localhost:5173
```

Without Google credentials, use **Cuba demo** on the login screen.

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the API and the web app together (Ctrl+C stops both) |
| `pnpm dev:api` · `pnpm dev:web` | Starts one side |
| `pnpm check` | Lint, typecheck, tests and build |
| `pnpm db:migrate` · `pnpm db:revision "message"` | Apply / create database migrations |
| `pnpm icons` | Regenerates the app icons from `public/Coinvoy.png` |

## Layout

| Path | What |
|---|---|
| `frontend/` | React + TypeScript + Vite PWA (TanStack Router and Query, Tailwind v4) |
| `backend/` | FastAPI + SQLAlchemy + Alembic (Google sign-in, sessions, and later the engine and AI routes) |
| `public/` | The master logo files |
| `scripts/` | Repo tools (icon generation) |

## Google sign-in setup

In Google Cloud Console, create an OAuth client of type *Web application* with:
- Authorized JavaScript origin: `http://localhost:5173`
- Authorized redirect URI: `http://localhost:5173/api/auth/google/callback`

Add your Gmail as a test user while the app is in Testing mode. Then put the client ID and secret in `.env`.
