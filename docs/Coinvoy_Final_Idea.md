# Coinvoy — Final Idea (v2)

**CODEFEST 2026 · Track 5: Finance (Financial Inclusion)**
*"Gaji rata setiap minggu" — a steady salary every week.*

> Refines [Coinvoy_Full_Breakdown.md](Coinvoy_Full_Breakdown.md). New in v2: **Semak Layak** (loan readiness + lender check), **Streaks**, a brief-coverage check, research on what wins hackathons, and updated scores.

---

## 1. The idea in one line

Coinvoy turns a gig rider's up-and-down weekly earnings into a **steady weekly "salary"** they pay themselves. The amount is safe because it has been stress-tested against 1,000 possible futures. When they're ready to buy a motorbike or car, Coinvoy tells them whether they can afford the loan and gives them proof of income to take to the bank.

**30-second version:**
> Riders earn RM900 one week and RM400 the next. Coinvoy predicts the coming weeks and says: "Pay yourself RM620 this week." Good weeks fill a buffer, and the buffer tops up bad weeks. Log every week to build a streak. After 12 weeks, you unlock an income statement and a loan check for that motorbike. No lending, no credit score.

**Analogy:** a motorbike shock absorber. The road (income) is bumpy, but the ride (salary) is smooth.

---

## 2. The problem

| Fact | Source |
|---|---|
| About **1.64 million** Malaysians earned income from gig work at the end of 2025 | [The Star, Jul 2026](https://www.thestar.com.my/business/business-news/2026/07/11/hailstorm-over-rides) |
| Driver groups say net earnings are **down 30–50%** compared with 3–4 years ago | [The Star, Jul 2026](https://www.thestar.com.my/business/business-news/2026/07/11/hailstorm-over-rides) |
| A "significant majority" of e-hailing and delivery drivers have **no emergency or retirement savings** | [SAYS / The Centre](https://says.com/my/news/a-risky-gig-majority-of-m-sian-e-hailing-delivery-drivers-have-no-insurance-or-savings) |
| The **Gig Workers Act 2025** came into force on 31 March 2026 | [NST](https://www.nst.com.my/amp/news/nation/2026/03/1403257/better-protection-gig-workers-under-new-law) |
| Budget 2026 **i-Saraan Plus**: gig workers get up to **RM600/year** in EPF matching | [Malay Mail](https://www.malaymail.com/news/malaysia/2025/10/10/budget-2026-gig-workers-to-get-up-to-rm600-a-year-in-epf-matching-under-new-i-saraan-plus-scheme/194145) |

**The core problem:** gig workers don't lack income. They lack **predictable** income. Banks, landlords and budgeting apps all assume a fixed monthly salary. With no payslip, riders struggle to get a loan for the very vehicle they earn with.

---

## 3. Does it solve the Track 5 brief?

It solves the brief **deeply for one named group (gig workers), not for all five**. That is deliberate: judges reward one problem solved well over five solved badly.

| What the Track 5 brief asks for | Covered? | How |
|---|---|---|
| Target group: gig economy workers | **Yes, deeply** | The whole app |
| Target group: B40 families | Partly | Most riders are B40 |
| Target groups: rural, street vendors, micro-SMEs | No | Out of scope; same engine fits them later |
| "Managing their finances" | **Yes** | Gaji, Tabung, Snap |
| "Access to financial products / financing" | **Yes (new)** | Semak Layak + Penyata prepare riders for a loan |
| Financial literacy | **Yes** | Celik + Tanya, using the rider's own numbers |
| "Identify financial risks online" | **Yes (new, small)** | Lender check inside Semak Layak |
| Suggested: smart budgeting | Yes | Gaji + Tabung |
| Suggested: AI financial literacy and coaching | Yes | Tanya |
| Suggested: alternative financing | Partly | Semak Layak + Penyata |
| Suggested: bookkeeping for micro-entrepreneurs | Partly | Snap logs income and costs |
| Stretch: real-time fraud scoring | Partly | Lender check gives a risk flag |
| Stretch: multi-user view (bank officer) | Stretch | Read-only Penyata for a lender |
| Stretch: open banking APIs | No | Not available to us; say so honestly |
| Rule: BM or bilingual (BM NLP bonus) | **Yes** | Full BM/EN; BM cost entry and chat |

**If a judge asks "why only gig workers?":** "1.64 million workers and a brand-new law. We'd rather solve one group completely. The forecast-and-salary engine works for any irregular income, so street vendors and micro-SMEs are next."

### Does the lender check clash with Track 4 (Cybersecurity)?

Not if we keep it small. The Track 5 brief itself asks for help to "identify financial risks online", and Track 5's stretch goals include "real-time fraud scoring". A general scam/phishing/deepfake detector would look like a Track 4 project, so we **don't build one**. The lender check is **one step inside Semak Layak**. It looks at the loan offer the rider is about to take, not their messages or browsing. It's about **illegal moneylending (a finance risk)**, not hacking.

---

## 4. Features

### Core loop
```
Snap → Ramal → Gaji → Tabung        (weekly, builds the Streak)
                 ↑
        Tanya (AI agent)     12-week streak → Penyata + Semak Layak
```

### Tier 1: core (the demo spine, must never break)

**Snap: log earnings**
- Upload **one screenshot a week** of the gig app's earnings page. Type costs in BM ("minyak RM40", "servis motor RM85").
- A vision LLM extracts gross earnings, commission, incentives, trips and hours, then the rider confirms with one tap.
- Needs no special phone permissions and takes about 10 seconds a week.

**Ramal: predict income**
- "Next 4 weeks: RM480–RM760 per week."
- LightGBM quantile forecast (P10/P50/P90) using hours, day-of-week, public and school holidays, Ramadan, Raya, payday, and MET Malaysia rain ([data.gov.my Weather API](https://developer.data.gov.my/realtime-api/weather)).
- With fewer than about 4 weeks of history, it runs in "learning" mode using population averages.

**Gaji: weekly salary (the main feature)**
- **"Your salary this week: RM620."** A good week puts the extra into the buffer. A lean week tops up from it.
- A Monte Carlo simulation runs 1,000 possible 12-week income paths. Coinvoy picks the **highest salary where the buffer stays above zero in at least 95% of paths**, and recalculates every week.
- It explains changes: "Your salary went down RM30 because Raya week is coming."

**Tanya: ask the AI agent**
- "Boleh tak saya ambil ansuran motor RM350 sebulan?" ("Can I afford a RM350/month motorbike instalment?") → "78% safe at 45 hours a week, 52% at 35."
- **Rule:** the agent **must call `simulate()`** before giving any number, so it can't make figures up.
- Tools: `get_forecast()`, `get_salary()`, `simulate(scenario)`, `get_pots()`, `explain(topic)`.

**BM/EN toggle** across the whole app.

### Tier 2: extra points

**Tabung: savings pots**
- Kecemasan (emergency), Motor, Raya, and **EPF i-Saraan Plus** ("Save and the government adds up to RM600 a year").
- Takes the PERKESO deduction under the Gig Workers Act into account.
- Virtual pots in the MVP. In production they become real savings pockets through a bank or e-wallet partner.

**Semak Layak: loan readiness (new)**
1. The rider enters what they want to buy: "Yamaha motorbike, RM8,000, 5 years" (or a car, a phone, anything).
2. Coinvoy works out the monthly instalment and runs it through `simulate()`.
3. **"This instalment is 81% safe on your income. Income stability: Stabil."**
4. **Lender check (optional):** the rider pastes the loan offer they received. Coinvoy checks the lender against a saved copy of BNM's [Financial Consumer Alert list](https://www.bnm.gov.my/financial-fraud-alerts) and flags red flags: an upfront fee, "no CTOS check", WhatsApp-only contact, an interest rate above the legal cap. It also suggests verifying the licence in KPKT's i-KrediKom app.
5. The rider downloads their **Penyata** to take to the bank.
- **Never called a credit score.** It's the rider checking their own affordability, and the bank still decides. That keeps us outside the Credit Reporting Agencies Act 2010.
- Honest limit: banks still check CCRIS/CTOS. We say "improves your chances", never "you'll be approved".

**Streaks: the hook (new)**
- **Weekly, not daily**, because the core action is one upload a week. Count "weeks logged" and "weeks I stuck to my Gaji".
- **A 12-week streak unlocks Penyata and Semak Layak.** The streak is the path to a loan, not a vanity badge. It also gives the forecast and Penyata the continuous data they need.
- **Streak freeze** for Raya week or a sick week.
- **Never reward hours worked or trips done.** Grab already gamifies drivers into overworking. Reward logging and saving only.

### Tier 3: stretch (only if the day-14 checkpoint passes)

| Feature | What it is |
|---|---|
| Penyata PDF | 3–6 month income statement: average, minimum, trend, hours |
| Bank-officer view | Read-only Penyata for a lender (brief's "multi-user view" stretch goal) |
| Streak share card | "🔥 16 minggu konsisten" with **no RM amounts** (PDPA) |
| Celik lessons | 30-second BM lessons from the rider's own data (commission share, flat vs effective rate, PERKESO 70% first-year subsidy) |
| Rain feature | MET Malaysia forecast inside Ramal |

### Explicitly cut
Moving real money, lending or advances, reading notifications or SMS, a general scam or phishing detector (that's Track 4), a native iOS app, blockchain, and calling anything a "credit score".

---

## 5. What wins hackathons (research)

Judges reward the team they understand fastest. In one judge write-up, a strong build with a confusing demo lost to a simpler project the judges could follow ([JetBrains, 2026](https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/)).

| What winners do | For Coinvoy |
|---|---|
| Lead with a problem judges *feel* | Open with Abang Faiz's real RM400 vs RM950 weeks and a real rider quote |
| Show it working within ~90 seconds | The "Gaji RM620" screen appears before 1:00 |
| One "this is now possible" moment beats a feature tour | The agent says "52% safe" and recommends against the instalment |
| One fully working core beats five half-working features ([WhereUElevate](https://whereuelevate.com/blogs/why-hackathon-projects-fail)) | Tier 1 must be rock solid before anything else |
| Read the rubric and plan around it ([HackerEarth](https://www.hackerearth.com/blog/10-tips-win-hackathon)) | Every slide and video scene maps to a criterion (§7) |
| Add a differentiator: real data or real users | Interview 5–10 riders; backtest on their screenshots |
| Mock slow parts, pre-fill data, keep a backup ([Reskilll](https://blogs.reskilll.com/hackathon-demo-presentation-tips-pitch-3-minutes-win-2026/)) | Seeded 12-week demo account; cached LLM calls; backup video take |
| Demo on the real device, never show code or a terminal | Record on a real Android phone |
| One person owns the pitch; rehearse out loud, timed ([Salesforce](https://developer.salesforce.com/blogs/2014/07/deliver-winning-pitch-hackathons)) | Pitch lead presents; 3+ timed run-throughs |
| Be honest about limits | "Virtual pots in the MVP; real pockets via a bank partner" |

**Why projects lose** (approximate shares from one practitioner guide): poor problem understanding (~32%), scope too big (~27%), buggy execution (~21%), weak presentation (~14%), weak teamwork (~6%). **Our biggest risk is scope.**

**Our rule:** if a feature isn't in the demo video, it doesn't get built before the core works.

---

## 6. Scores (our estimate)

| Criterion | Weight (prelim / finale) | v1 | **v2** | Why it changed |
|---|---|---|---|---|
| Impact | 30% / 30% | 9 | **9.5** | Hits "access to financing" and "identify financial risks online" |
| Technical Execution | 30% / 25% | 9 | 9 | Reuses `simulate()`; little new tech |
| Usability | 25% / 25% | 9 | **9.5** | Streaks give riders a weekly reason to return |
| Feasibility | 15% / 20% | 8 | **8.5** | Referral revenue from banks and dealers; no licence needed |
| **Prelim total** | | 89 | **≈ 92** | |
| **Finale total** | | 88 | **≈ 92** | |

If Semak Layak is pitched as a "credit score", Feasibility drops to about 6 and the totals fall to **≈ 88 / 87**, lower than v1.

---

## 7. Judging criteria → the proof we show

| Criterion | Proof judges can see | Where |
|---|---|---|
| Impact | 1.64M workers, Gig Workers Act, real rider quotes, unclaimed i-Saraan Plus RM600/yr | Slides 2, 6; video 0:00–0:25 |
| Technical | Backtest error on real data; Monte Carlo 95% rule; agent forced through `simulate()`; FCA-list check | Slide 4; video 1:25–2:05 |
| Usability | One screenshot a week, one number, all BM, streaks; tested with 3+ riders | Slide 5; whole video on a phone |
| Feasibility | No lending or credit licence; who pays; cost ≈ one LLM call per user per week | Slide 6; video 2:40–3:00 |

**Finale:** Feasibility rises to 20%, so add a cost-per-user figure, a named pilot partner (even a letter of interest from a rider community or cooperative), and a 12-month roadmap.

---

## 8. Architecture and stack

```
 ┌──────────────┐     ┌──────────────────────┐
 │  Rider PWA   │◄───►│   FastAPI backend    │──── SQLite (users, weeks, streaks)
 │  (BM / EN)   │     │   LLM cost cap       │
 └──────────────┘     └──────────┬───────────┘
        ┌───────────────┬────────┴────────┬────────────────────┐
        ▼               ▼                 ▼                    ▼
 ┌─────────────┐ ┌──────────────┐ ┌───────────────┐ ┌────────────────────┐
 │ Snap        │ │ Ramal + Gaji │◄│ Tanya agent   │ │ Semak Layak        │
 │ vision LLM  │ │ LightGBM P10–│ │ 5 tools, must │ │ instalment →       │
 │ reads       │ │ P90 + Monte  │◄│ call simulate │ │ simulate() +       │
 │ screenshot  │ │ Carlo (95%)  │ └───────────────┘ │ lender check (FCA) │
 └─────────────┘ └──────────────┘                   └────────────────────┘
        ▲               ▲                                      ▲
 ┌──────────────────────────────────────────────────────────────────────┐
 │ Data: real rider screenshots (consented) + synthetic income paths    │
 │ data.gov.my weather + holidays · BNM FCA list (saved copy)           │
 └──────────────────────────────────────────────────────────────────────┘
```

**The main technical claim:** the LLM only reads and talks. Every number the rider sees comes from the forecast and Monte Carlo engine.

| Layer | Tech |
|---|---|
| Frontend | Mobile-first PWA (installable, works on cheap Android) |
| Backend | Python, FastAPI |
| Database | SQLite |
| ML | LightGBM quantile regression, NumPy Monte Carlo |
| AI | One LLM with vision (Snap, lender check) and tool calling (Tanya) |
| Open data | data.gov.my Weather API, public holiday calendar, BNM FCA list |
| PDF | Any HTML-to-PDF library (Penyata) |

---

## 9. Data strategy (our edge)

1. **Interview 5–10 riders** and collect 8–12 weeks of earnings screenshots **with written consent**, names and IDs removed.
2. Use them to test extraction and **backtest the forecast**. Put the error on slide 4.
3. Add **synthetic income paths** built from the real patterns for the Monte Carlo and the demo account.
4. **Production:** platform data via the Gig Workers Act's PERKESO linkage, or platform partnerships.

---

## 10. Business model

- **Free for riders.**
- **Gig platforms:** a "driver financial wellness" benefit that helps retention and Gig Workers Act compliance.
- **Digital banks and e-wallets:** pay per active saver (real pockets behind Tabung).
- **Banks, motor dealers, TEKUN and cooperatives:** pay per referred applicant from Semak Layak who arrives with a Penyata.
- **Scaling:** one model serves all platforms; each new platform needs only one new screenshot parser. Main cost is one LLM call per user per week.

---

## 11. Team roles (4 people)

| Role | Owns |
|---|---|
| **ML lead** | Ramal + Gaji engine, `simulate()`, backtest |
| **Backend + AI lead** | FastAPI, Snap extraction, Tanya agent, Semak Layak + lender check |
| **Frontend + UX lead** | PWA, Gaji screen, chat, Tabung, streaks, BM/EN |
| **Product + pitch lead** | Rider interviews + consent, Celik, fact checks, slides, video, README, presents |

*With 3 people:* the pitch lead's build work moves to frontend.

---

## 12. 21-day build plan

> Assumes 21 days. Adjust once the deadline is confirmed.

| Days | Phase | Goal |
|---|---|---|
| 1–2 | Lock it down | Repo, API contract (`Earning`, `Expense`, `Forecast`, `Salary`, `SimulateRequest`, `Pot`), LLM key + cost cap, book rider interviews, consent form |
| 3–8 | Rough end to end | Snap (1 platform), baseline forecast + Monte Carlo Gaji, upload → salary screen with BM/EN |
| **8** | **Checkpoint** | Upload a real screenshot → get a salary. Fail → drop Tier 3 now. |
| 9–14 | The product | LightGBM + calendar features, Tanya + `simulate()` rule, BM cost entry, Tabung, streak counter, test with 3 riders |
| **14** | **Checkpoint** | The full Abang Faiz demo runs without help. Pass → Tier 2/3. |
| 15–18 | Prove + polish | Backtest on real data, Semak Layak + lender check, empty/error states, deploy, fact-check i-Saraan Plus + moneylender caps |
| **18** | **Feature freeze** | |
| 19–21 | Submit | Slides, video (+ backup take), README (setup, architecture, consent, backtest), submit a day early, test the repo link logged out |

**Cut order if behind:** rain → share card → bank-officer view → Celik → Penyata PDF → lender check → 2nd platform parser.
**Never cut:** Gaji engine, the `simulate()` rule, BM toggle, real-data backtest.

---

## 13. Slides (required 6-section structure)

| Slide | Content |
|---|---|
| **1. Project & Team** | Coinvoy, team name, members and roles |
| **2. Problem & Track** | Track 5. 1.64M gig workers, earnings down 30–50%, no savings, no payslip, can't get a loan. Gig Workers Act. A real rider quote. |
| **3. Solution & Value** | Snap → Ramal → Gaji → Tabung, plus Tanya and Semak Layak, with Streaks as the hook. A steady salary and loan readiness, without lending. |
| **4. Technical Implementation** | Architecture, stack, backtest error, the 95% rule, `simulate()` guardrail, open data |
| **5. UX & Design** | Abang Faiz's journey in 5 phone screenshots |
| **6. Feasibility & Impact** | Who pays, scaling, cost per user; outcomes: weeks without running short, buffer size, i-Saraan RM claimed, riders loan-ready |

---

## 14. Demo video (3 minutes, prelim)

Record one story on a real Android phone with a seeded 12-week account.

| Time | Scene | Criterion |
|---|---|---|
| 0:00–0:20 | **Problem:** Faiz's RM400 vs RM950 weeks, instalment due, Raya coming. 1.64M gig workers. A real rider quote. | Impact |
| 0:20–0:35 | "Coinvoy turns uneven earnings into a steady weekly salary, with no loans." | Impact |
| 0:35–1:00 | **Snap:** upload a screenshot, the numbers appear; type "minyak RM40" | Usability |
| 1:00–1:25 | **Gaji:** "Gaji anda minggu ini: RM620"; buffer in a good week, top-up in a lean week; streak ticks to 12 → Semak Layak unlocks | Usability, Technical |
| 1:25–2:05 | **Tanya / Semak Layak:** "Boleh ambil motor RM8,000?" → "52% at 35 hrs, 78% at 45 hrs" → recommends against the unsafe option | Technical |
| 2:05–2:25 | **Lender check:** paste a WhatsApp loan offer → "Risiko tinggi: upfront fee, lender on BNM alert list" | Impact |
| 2:25–2:40 | Architecture + backtest error, 10 seconds | Technical |
| 2:40–3:00 | Who pays, Gig Workers Act, team names. Stop. | Feasibility |

**Finale (5-minute live pitch):** the same story plus 2 minutes of proof: interview results, backtest chart, cost per user, pilot partner, and the roadmap to street vendors and micro-SMEs. A teammate drives the phone while the pitch lead narrates. Keep the recorded video ready in case the live demo fails.

---

## 15. Risks and hard judge questions

| Risk | Fallback |
|---|---|
| Too many features, none polished | Tier 1 only until day 14; fixed cut order |
| Not enough real rider data | Mix with synthetic paths; state the sample size honestly |
| Screenshot extraction fails on some layouts | 2 platforms well; manual correction screen |
| LLM slow during the demo | Cached demo run; backup take |
| FCA list can't be scraped | Use a saved copy, dated on screen |

| Question | Answer |
|---|---|
| Isn't this just a budgeting app? | Budgeting apps assume a fixed income. Coinvoy *creates* one from a variable income. |
| Is Semak Layak a credit score? | No. The rider checks their own affordability; the bank decides. |
| Isn't the lender check a Track 4 project? | It's one step inside a loan decision, about illegal moneylending. The Track 5 brief asks for help to "identify financial risks online". |
| Screenshots can be faked. | Faking only hurts the rider's own plan. For lenders, production uses platform-verified data via the Gig Workers Act linkage. |
| Don't streaks push riders to overwork? | We reward logging and saving, never hours or trips. A streak freeze covers Raya and sick weeks. |
| Is the AI giving financial advice? | It reports simulated odds; the rider decides; a disclaimer is shown. |
| Isn't this lending? | No. The money comes from the rider's own earnings. |
| Who pays? | Platforms, digital banks, and lenders/dealers per referred applicant. Free for riders. |

---

## 16. Open questions

- [ ] Prelim deadline and submission link?
- [ ] 3 or 4 people?
- [ ] Which LLM provider, and who pays for the key?
- [ ] Which 2 platforms do the interviewed riders use?
- [ ] Rider consent form and safe data storage (PDPA)?
- [ ] Confirm the i-Saraan Plus matching rate with EPF (the RM600/yr cap is confirmed)
- [ ] Confirm the moneylender interest caps and that i-KrediKom is still current

---

## Sources

- [The Star: 1.64M gig workers, earnings down 30–50% (Jul 2026)](https://www.thestar.com.my/business/business-news/2026/07/11/hailstorm-over-rides)
- [NST: Gig Workers Act in force (Mar 2026)](https://www.nst.com.my/amp/news/nation/2026/03/1403257/better-protection-gig-workers-under-new-law)
- [SAYS / The Centre: gig workers lack savings](https://says.com/my/news/a-risky-gig-majority-of-m-sian-e-hailing-delivery-drivers-have-no-insurance-or-savings)
- [Malay Mail: Budget 2026 i-Saraan Plus up to RM600/yr](https://www.malaymail.com/news/malaysia/2025/10/10/budget-2026-gig-workers-to-get-up-to-rm600-a-year-in-epf-matching-under-new-i-saraan-plus-scheme/194145)
- [Business Today: i-Saraan 20% matching (Jul 2026)](https://www.businesstoday.com.my/2026/07/08/gig-workers-retirement-gap-remains-key-concern-as-govt-defends-epf-incentives/)
- [Borneo Post: PERKESO incentives for gig workers](https://www.theborneopost.com/?p=1283550)
- [BNM: Financial fraud alerts / FCA list](https://www.bnm.gov.my/financial-fraud-alerts)
- [NST: BNM names over 500 suspected scam firms (2025)](https://www.nst.com.my/amp/news/nation/2025/09/1270514/bnm-names-over-500-suspected-scam-firms)
- [RTM: KPKT moneylender complaints and i-KrediKom](https://berita.rtm.gov.my/nasional/senarai-berita-nasional/senarai-artikel/252-aduan-pemberi-pinjam-wang-kpkt-keluarkan-83-kompaun/)
- [data.gov.my Weather API](https://developer.data.gov.my/realtime-api/weather)
- [JetBrains: How to win a hackathon, notes from the judging table (Jun 2026)](https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/)
- [WhereUElevate: Why most hackathon projects fail](https://whereuelevate.com/blogs/why-hackathon-projects-fail)
- [Reskilll: Hackathon demo and presentation tips (2026)](https://blogs.reskilll.com/hackathon-demo-presentation-tips-pitch-3-minutes-win-2026/)
- [HackerEarth: 10 tips to win a hackathon](https://www.hackerearth.com/blog/10-tips-win-hackathon)
- [Salesforce: Deliver a winning pitch at hackathons](https://developer.salesforce.com/blogs/2014/07/deliver-winning-pitch-hackathons)
- [TechCrunch: SteadyPay (UK)](https://techcrunch.com/2022/03/04/london-based-steadypay-helps-freelancers-and-gig-workers-stabilize-their-income)
- CODEFEST 2026 brief ([CODEFEST_2026_Brief.md](CODEFEST_2026_Brief.md))
