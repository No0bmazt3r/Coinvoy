<p align="center">
  <img src="public/Coinvoy-tile.png" alt="Coinvoy logo" width="200">
</p>

<h1 align="center">Coinvoy</h1>

<p align="center">
  <b>Tiada majikan? Coinvoy beri apa yang majikan beri.</b><br>
  A steady weekly salary, payslips, contributions, paid leave and an advisor for Malaysian gig riders, using only their own money.
</p>

<p align="center">
  <img alt="TRACK 5 · FINANCE" src="https://img.shields.io/badge/TRACK-5%20%C2%B7%20FINANCE-B5FC04?style=for-the-badge&labelColor=1D1E1D">
  <img alt="BAHASA BM + EN" src="https://img.shields.io/badge/BAHASA-BM%20%2B%20EN-136C33?style=for-the-badge&labelColor=1D1E1D">
  <img alt="TESTS 162 PASSING" src="https://img.shields.io/badge/TESTS-162%20PASSING-4C1?style=for-the-badge&labelColor=1D1E1D">
  <img alt="LICENSE MIT" src="https://img.shields.io/badge/LICENSE-MIT-C4A5F5?style=for-the-badge&labelColor=1D1E1D">
</p>

<p align="center"><sub>built with</sub></p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React%2019-20232A?style=flat&logo=react&logoColor=61DAFB">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white">
  <img alt="TanStack" src="https://img.shields.io/badge/TanStack%20Router%20%2B%20Query-FF4154?style=flat&logo=reactquery&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-5A0FC8?style=flat&logo=pwa&logoColor=white">
</p>

<p align="center">
  <img alt="Node 24" src="https://img.shields.io/badge/Node%2024-5FA04E?style=flat&logo=nodedotjs&logoColor=white">
  <img alt="Express 5" src="https://img.shields.io/badge/Express%205-000000?style=flat&logo=express&logoColor=white">
  <img alt="Drizzle" src="https://img.shields.io/badge/Drizzle%20ORM-C5F74F?style=flat&logo=drizzle&logoColor=1D1E1D">
  <img alt="Postgres" src="https://img.shields.io/badge/Postgres%20%2B%20PGlite-4169E1?style=flat&logo=postgresql&logoColor=white">
  <img alt="zod" src="https://img.shields.io/badge/zod-3E67B1?style=flat&logo=zod&logoColor=white">
</p>

<p align="center">
  <img alt="Python 3.12" src="https://img.shields.io/badge/Python%203.12-3776AB?style=flat&logo=python&logoColor=white">
  <img alt="NumPy" src="https://img.shields.io/badge/NumPy-013243?style=flat&logo=numpy&logoColor=white">
  <img alt="scikit-learn" src="https://img.shields.io/badge/scikit--learn-F7931E?style=flat&logo=scikitlearn&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI%20(ML%20service)-009688?style=flat&logo=fastapi&logoColor=white">
  <img alt="Google Sign-In" src="https://img.shields.io/badge/Google%20Sign--In-4285F4?style=flat&logo=google&logoColor=white">
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest%20%2B%20pytest-6E9F18?style=flat&logo=vitest&logoColor=white">
</p>

<p align="center"><sub>UTP CodeFest '26 · Track 5: Finance (Financial Inclusion)</sub></p>

---

## What it does

Gig riders earn RM900 one week and RM400 the next, with no payslip, no contributions and no paid leave. Coinvoy gives them the five things an employer gives, **using only their own money**: it never lends, never holds funds, and is not a credit score.

| Benefit | In the app |
|---|---|
| **Gaji Tetap** (steady pay) | One weekly salary, safe in 95% of 1,000 simulated futures. "Pindah RM168 ke poket Penampan" → the rider moves it in their own bank → **Dah pindah**. The buffer counts confirmed transfers only. A short guide sets up the pocket in the rider's own bank, and a payday notification opens Snap. |
| **Slip Gaji** (payslip) | Weekly payslips and a Penyata PDF where every figure is labelled *Dilapor sendiri* / *Disemak silang* (self-reported / cross-checked against a bank statement), plus a revocable read-only link for a loans officer. |
| **Caruman** (contributions) | i-Saraan set-asides with a "Duit kerajaan dituntut" (government money claimed) counter; PERKESO shown as deducted at source. |
| **Cuti Berbayar** (paid leave) | Plan Raya leave, set a little aside each week, and the week off still pays. Sick days are covered too. |
| **Penasihat** (advisor) | Tanya (chat where every number must come from the engine), Semak Layak (can I afford this instalment?), a lender check against BNM's alert list, Jurang (an honest gap view when income is too low), and Celik lessons. |

Earnings come in by **Snap** (an AI reads the earnings screenshot into an editable draft; nothing is saved until the rider confirms) or typed in. Costs are typed in BM ("isi minyak empat puluh") and parsed by our own rules and classifier first. Streaks reward logging and saving, never hours, and unlock cosmetic levels and badges only; the share card shows the week count and never an RM amount.

## Run it

You need Node 24 with [pnpm](https://pnpm.io), and Python 3.12 with [uv](https://docs.astral.sh/uv/). No database to install: locally the API uses an embedded Postgres (PGlite).

```bash
pnpm bootstrap          # installs the web app, the API and the ML service
cp .env.example .env    # optional: Google sign-in and an LLM key (see below)
pnpm dev                # API :8000 · ML service :8001 · app http://localhost:5173
```

Without any keys, tap **Cuba demo**: you land on Abang Faiz's account (12 weeks of labelled synthetic data) with a working salary. The second button opens Kak Lina, whose safe salary is below her essentials, so the app shows Jurang and its three options. Snap and Tanya need an LLM key; everything else works without one.

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the API, the ML service and the web app together |
| `pnpm check` | Lint, typecheck, all tests and the production build |
| `pnpm test` | ML (pytest) + API (vitest, against the real ML service) + web tests |
| `pnpm db:generate` | Writes a SQL migration from `api/src/db/schema.ts` (applied when the API starts) |
| `pnpm train:bm` | Regenerates the seed phrases and retrains the BM cost classifier |
| `pnpm train:rate <csv>` | Trains the pooled rate model on rider histories and writes its model card (`--synthetic N` for a dry run) |
| `pnpm icons` | Regenerates the app icons from `public/Coinvoy.png` |

**Any LLM provider.** Set `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL` in `.env` for OpenRouter, Gemini, OpenAI, Anthropic or Ollama (all OpenAI-compatible; examples in `.env.example`). Switching provider is never a code change.

## How it works

```
 Phone (PWA, BM/EN) ──HTTPS──► api/  Node 24 + Express 5 + Drizzle ──► Postgres (PGlite locally)
                                 │  auth, every route, the AI calls (Snap, Tanya, lender check),
                                 │  the number guard, image cleanup, the built PWA (same origin)
                                 ▼  JSON over a private network, shared token
                               ml/   Python: the salary engine, our BM classifier, the Penyata PDF
```

**The salary.** Income is forecast as rate × hours: the rider's own average RM per hour, shrunk toward a population prior when there are few weeks. The engine simulates 1,000 12-week futures with a **block bootstrap** (runs of 4 consecutive weeks, so bad spells stay together), subtracts bills, contributions and leave set-asides in the weeks they fall due, and searches for the largest whole-ringgit salary that keeps the buffer at or above zero in at least 95% of futures. While the buffer is below 2 weeks of essentials, it also has to reach that target within about 8 weeks. Same rider, same week, same seed: the number doesn't jitter.

**The Malaysian calendar.** Ramadan, public holidays and school holidays (`ml/app/engine/data/calendar_my.json`) are features of every week: past weeks have their season effect taken out before fitting, and future weeks get theirs put back, so a Raya week isn't mistaken for a slump and Ramadan ahead is planned for. A pooled gradient-boosted rate model (`ml/app/engine/rate_model.py`, scikit-learn's LightGBM-style histogram boosting) can replace the shrinkage mean, but stays off until it beats it on real histories.

**The AI is fenced in.** Every number Tanya says is checked by plain code against the tool results and the rider's own message (`api/src/llm/guard.ts`): a made-up figure triggers one retry, then a reply built only from tool output. Snap and the lender check have no tools and must answer in a schema; text inside a screenshot is data, never instructions.

**BM NLP, our own.** Cost phrases go through rules (BM number words like "dua ratus lima puluh", "rm40", "1.5k"), then our TF-IDF + logistic regression classifier (`ml/app/nlp/`), and only reach the LLM when both are unsure. A number the rules found always wins over the LLM.

## Results (honest status)

| What | Status |
|---|---|
| Walk-forward backtest (`ml/scripts/backtest.py`) | **Dry run on 30 synthetic riders only**: Coinvoy ran short in 0.0% of 660 replayed weeks vs 1.2% for "4-week average − 20%", at a higher median salary (RM594 vs RM511); the slow–busy band held 74.8% of weeks. Synthetic data follows the engine's own assumptions, so this is **not evidence**. The real run waits on consented rider histories. |
| Pooled rate model (`ml/app/engine/artifacts/rate_model_card.md`) | **Synthetic dry run only**: held-out log-rate error 0.213 vs 0.220 for the shrinkage forecast; in the synthetic backtest, 0.0% short, median salary RM615. The synthetic riders overlap with its training data, so this proves the pipeline runs, nothing more. Off by default (`RATE_MODEL`). |
| Calendar data | Transcribed from the official calendars but **not yet checked line by line** (`verified: false`); the season effect sizes are team estimates until fitted on real histories. |
| BM classifier (`ml/app/nlp/artifacts/model_card.md`) | Trained on 770 **synthetic seed** phrases. The real held-out test set (150+ rider phrases) is not collected yet, so there is no real accuracy figure. |
| Snap accuracy (`api/scripts/eval-snap.ts`) | Script ready; needs labelled real screenshots. |
| Cost per rider (`api/scripts/llm-cost-report.ts`) | Script ready; needs real usage and a dated price table (`api/data/llm_prices.json`). |

## Security

| Threat | What stops it |
|---|---|
| Account takeover | Google sign-in only (OIDC code flow with state, PKCE S256 and nonce), no passwords; server-side sessions with only a SHA-256 of the token stored; httpOnly SameSite cookie; 7-day expiry; logout deletes the session |
| Seeing another rider's data | Every query is scoped to the signed-in rider; tests check that another rider's IDs return 404 |
| Cross-site requests | SameSite cookie + an Origin check on every unsafe request |
| Made-up numbers from the LLM | The number guard (above), tested |
| Prompt injection via a screenshot or pasted offer | No tools on those routes, schema-only output, clear delimiters; tested with an injected screenshot |
| Runaway LLM costs | Per-rider daily limits and a monthly call cap; manual entry always works |
| Leaked keys | Secrets only in env vars; `.env` git-ignored; gitleaks in CI |
| Officer link leakage | Random 128-bit tokens stored hashed, 7-day expiry, revocable (410), noindex |
| Brute force | Rate limit on the auth routes; CSP, nosniff and Referrer-Policy headers |
| Secrets in logs | Structured JSON request logs carry method, path, status, time and rider ID only: no bodies, emails or query strings, and officer-link tokens are masked |
| Admin access | The usage view (counts, retention, AI cost; no rider data) is limited to `ADMIN_EMAILS`, never demo accounts, and answers 404 to everyone else |

## Privacy (PDPA)

Screenshots and statement PDFs are read in memory and **never stored**; EXIF is stripped first. Riders consent to the privacy notice and, separately, to AI processing; the privacy page names the AI provider and its region. Tanya messages are deleted after 90 days and demo accounts after 24 hours. Riders can download all their data or delete their account (every row cascades) from Profil. Indeks Rider is opt-in, stores no user ID, and shows nothing for groups under 20. Payday reminders are opt-in per device (the browser asks first) and are switched off on sign-out, so a shared phone doesn't keep reminding the last rider.

## Legal positioning

| Topic | Position |
|---|---|
| Lending | None. No loans, advances or earned-wage access. The money is always the rider's own. |
| Holding funds | Never. The pockets belong to the rider's licensed bank or e-wallet; Coinvoy only tracks earmarks. |
| Credit reporting | Not a credit score; the rider shares only their own statement and the lender decides. |
| Financial advice | Information from the rider's own data, labelled as an estimate with a disclaimer; the rider decides. |
| Lender check | States facts ("appears on BNM's alert list, copy dated …"), never accusations; points to KPKT's licence check. |
| Rates and schemes | i-Saraan match, PERKESO rate and moneylender caps are configuration, to be verified against official sources before any pitch. |

## Layout

| Path | What |
|---|---|
| `frontend/` | React 19 + TypeScript + Vite PWA (TanStack Router and Query, Tailwind v4), BM/EN, offline shell |
| `api/` | Express 5 + zod + Drizzle API; `src/routes`, `src/services`, `src/llm` (client, Snap, Tanya, guard), `drizzle/` SQL migrations, `test/` |
| `ml/` | Python ML service: `app/engine` (forecast, simulation, salary search), `app/nlp` (BM parser + classifier), `app/render` (Penyata), `scripts/` (training, backtest, evaluation) |
| `Dockerfile.ml` · `render.yaml` | Deployment: the API + PWA as a native Node web service, the ML service private, Postgres, Singapore |
| `.github/workflows/ci.yml` | Lint, types, tests (also on real Postgres), bundle budget, gitleaks, Docker builds |

## Google sign-in setup

In Google Cloud Console, create an OAuth client of type *Web application* with:
- Authorized JavaScript origin: `http://localhost:5173`
- Authorized redirect URI: `http://localhost:5173/api/auth/google/callback`

Add your Gmail as a test user while the app is in Testing mode, then put the client ID and secret in `.env`. In production, add the deployed origin and `https://<domain>/api/auth/google/callback`.

## Team: AI Don't Know

<table>
  <tr>
    <td align="center" width="25%"><img src="public/team/Wardah.svg" alt="Nurul Hawardah" width="160"><br><b>Nurul Hawardah Binti Mohammad Yusoff</b></td>
    <td align="center" width="25%"><img src="public/team/Zuyyin.svg" alt="Zuyyin Damia" width="160"><br><b>Zuyyin Damia Binti Norazmi</b></td>
    <td align="center" width="25%"><img src="public/team/Batrisyia%20Bilqis.svg" alt="Batrisyia Bilqis" width="160"><br><b>Batrisyia Bilqis Binti Ahmad Ridzuan</b></td>
    <td align="center" width="25%"><img src="public/team/Sharvin.svg" alt="Sharvin" width="160"><br><b>Sharvin A/L Kanesan</b></td>
  </tr>
</table>
