<p align="center">
  <img src="frontend/public/logo.png" alt="Coinvoy logo" width="200">
</p>

<h1 align="center">Coinvoy</h1>

<p align="center">
  <b>Tiada majikan? Coinvoy beri apa yang majikan beri.</b><br>
  A steady weekly salary, payslips, contributions, paid leave and an advisor for Malaysian gig riders, using only their own money.
</p>

<p align="center">
  <img alt="TRACK 5 · FINANCE" src="https://img.shields.io/badge/TRACK-5%20%C2%B7%20FINANCE-B5FC04?style=for-the-badge&labelColor=1D1E1D">
  <img alt="BAHASA BM + EN" src="https://img.shields.io/badge/BAHASA-BM%20%2B%20EN-136C33?style=for-the-badge&labelColor=1D1E1D">
  <img alt="TESTS 12 PASSING" src="https://img.shields.io/badge/TESTS-12%20PASSING-4C1?style=for-the-badge&labelColor=1D1E1D">
  <img alt="LICENSE MIT" src="https://img.shields.io/badge/LICENSE-MIT-C4A5F5?style=for-the-badge&labelColor=1D1E1D">
</p>

<p align="center"><sub>built with</sub></p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React%2019-20232A?style=flat&logo=react&logoColor=61DAFB">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white">
  <img alt="TanStack Router" src="https://img.shields.io/badge/TanStack%20Router-FF4154?style=flat&logo=reactquery&logoColor=white">
  <img alt="TanStack Query" src="https://img.shields.io/badge/TanStack%20Query-FF4154?style=flat&logo=reactquery&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-5A0FC8?style=flat&logo=pwa&logoColor=white">
</p>

<p align="center">
  <img alt="Python 3.12" src="https://img.shields.io/badge/Python%203.12-3776AB?style=flat&logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white">
  <img alt="Pydantic" src="https://img.shields.io/badge/Pydantic-E92063?style=flat&logo=pydantic&logoColor=white">
  <img alt="SQLAlchemy" src="https://img.shields.io/badge/SQLAlchemy-D71F00?style=flat&logo=sqlalchemy&logoColor=white">
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white">
  <img alt="Uvicorn" src="https://img.shields.io/badge/Uvicorn-499848?style=flat&logo=gunicorn&logoColor=white">
</p>

<p align="center">
  <img alt="Google Sign-In" src="https://img.shields.io/badge/Google%20Sign--In-4285F4?style=flat&logo=google&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?style=flat&logo=pnpm&logoColor=white">
  <img alt="uv" src="https://img.shields.io/badge/uv-DE5FE9?style=flat&logo=uv&logoColor=white">
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white">
  <img alt="pytest" src="https://img.shields.io/badge/pytest-0A9EDC?style=flat&logo=pytest&logoColor=white">
  <img alt="Ruff" src="https://img.shields.io/badge/Ruff-D7FF64?style=flat&logo=ruff&logoColor=1D1E1D">
</p>

<p align="center"><sub>UTP CodeFest '26 · Track 5: Finance (Financial Inclusion)</sub></p>

---

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
