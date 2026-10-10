# Coinvoy — Full Breakdown

**CODEFEST 2026 · Track 5: Finance (Financial Inclusion)**
*"Gaji rata setiap minggu" — a steady salary every week.*

---

## 1. The idea in one line

Coinvoy turns a gig rider's up-and-down weekly earnings into a **steady weekly "salary"** they pay themselves. The amount is safe because it has been stress-tested against 1,000 possible futures.

**Explaining it to anyone in 30 seconds:**
> Gig riders earn RM900 one week and RM400 the next. They spend everything in the good weeks and are broke in the bad ones. Coinvoy looks at their past earnings, predicts the coming weeks, and tells them: "Pay yourself RM620 this week." Extra from good weeks goes into a buffer, and the buffer tops them up in bad weeks. It feels like a real salary, with no loan involved.

**Analogy:** a motorbike shock absorber. The road (income) is bumpy, but the ride (salary) is smooth.

---

## 2. The problem

| Fact | Source |
|---|---|
| About **1.64 million** Malaysians earned income from gig work at the end of 2025 | [The Star, Jul 2026](https://www.thestar.com.my/business/business-news/2026/07/11/hailstorm-over-rides) |
| Driver groups say net earnings are **down 30–50%** compared with 3–4 years ago, and drivers are working longer hours just to keep income level | [The Star, Jul 2026](https://www.thestar.com.my/business/business-news/2026/07/11/hailstorm-over-rides) |
| A "significant majority" of e-hailing and delivery drivers have **no emergency or retirement savings** (The Centre, 464 drivers surveyed) | [SAYS](https://says.com/my/news/a-risky-gig-majority-of-m-sian-e-hailing-delivery-drivers-have-no-insurance-or-savings) |
| The **Gig Workers Act 2025** came into force on 31 March 2026. Social security contributions become mandatory, and platforms must link to PERKESO | [NST](https://www.nst.com.my/amp/news/nation/2026/03/1403257/better-protection-gig-workers-under-new-law) |
| The Track 5 brief names **gig economy employees** as a target group | CODEFEST brief |

**The core problem:** gig workers don't lack income. They lack **predictable** income. Banks, landlords and budgeting apps all assume a fixed monthly salary, and gig workers don't have one.

**Why existing tools fall short:**
- Budgeting apps assume a fixed salary, so they break when income swings.
- Banks want payslips, and gig workers don't have any.
- Overseas income-smoothing apps (SteadyPay in the UK) work by **lending** money in bad months. That brings interest, debt risk and licensing problems.

---

## 3. Is it original?

- **Overseas:** Even (US, 2015) offered paycheck smoothing for a fee. [SteadyPay](https://techcrunch.com/2022/03/04/london-based-steadypay-helps-freelancers-and-gig-workers-stabilize-their-income) (UK) tops up low months with interest-free advances.
- **Malaysia:** our search found **no local income-smoothing product** for gig workers.
- **What's new in Coinvoy:**
  1. **No lending.** Smoothing comes from the worker's own buffer, so no lending licence is needed.
  2. **The salary is set by a chance-constrained simulation,** not a simple average.
  3. **Malaysia-specific:** Ramadan, Raya, school holidays, MET Malaysia rain forecasts, EPF i-Saraan matching, PERKESO deductions.
  4. **BM-first,** with an AI agent that answers "can I afford this?" using real odds.

---

## 4. Target users

| User | Description |
|---|---|
| **Primary** | Food delivery and e-hailing riders and drivers (Grab, foodpanda, Lalamove, ShopeeFood), aged 20–50, Android, BM-speaking, often working full-time gig hours |
| **Secondary** | Part-time gig workers (students, people with a second job) |
| **Partner (B2B)** | Gig platforms that want to keep drivers, and digital banks or e-wallets that want new customers |

**Demo persona: Abang Faiz**, 29, a foodpanda rider in Ipoh. He earns RM400–RM950 a week, has a RM280/month motorbike instalment, and sends money home. Every Raya he's broke, and in rainy weeks he can't make his instalment.

---

## 5. Features

### Core loop
```
Snap → Ramal → Gaji → Tabung
                  ↑
         Tanya (AI agent)    Penyata (income statement)
```

### Feature 1: Snap (log earnings)
- **The rider:** uploads **one screenshot a week** of the earnings page in their gig app, and types costs in BM ("minyak RM40", "servis motor RM85").
- **The app:** a vision LLM extracts gross earnings, commission, incentives, trips and hours online, and shows them for a one-tap confirm.
- **Why this approach:** it needs no special phone permissions (no notification reading), takes 10 seconds a week, and works on any phone.

### Feature 2: Ramal (predict income)
- **The rider sees:** "Next 4 weeks: RM480–RM760 per week."
- **Under the hood:** a LightGBM quantile forecast (P10 / P50 / P90 = pessimistic / typical / optimistic) using:
  - hours worked, day-of-week patterns
  - public and school holidays, Ramadan, Raya, payday (the 25th)
  - **rain forecasts from MET Malaysia** via the free [data.gov.my Weather API](https://developer.data.gov.my/realtime-api/weather)
- Until there are about 4 weeks of history, it runs in "learning" mode using population averages.

### Feature 3: Gaji (weekly salary, the main feature)
- **The rider sees one number:** **"Your salary this week: RM620."**
  - Good week (earned RM900): RM280 goes into the buffer.
  - Lean week (earned RM450): RM170 comes out of the buffer.
- **Under the hood:** a Monte Carlo simulation runs 1,000 possible next-12-week income paths from the forecast. Coinvoy picks the **highest weekly salary where the buffer stays above zero in at least 95% of paths**. Each week it recalculates with the new data.
- **Explainable:** "Your salary went down RM30 because Raya week is coming and your buffer is lower."

### Feature 4: Tabung (savings pots)
- Automatic pots: **Kecemasan** (emergency), **Motor** (service, tyres, road tax, insurance), **Raya**, **EPF i-Saraan**.
- **i-Saraan nudge:** "Save RM100 into EPF and the government adds RM20." The sources disagree on current terms (RM20 per RM100 up to RM500/year, or an RM600 "i-Saraan Plus"), so **check them with EPF before the demo**.
- Takes the mandatory PERKESO deduction under the Gig Workers Act into account.
- In the MVP these are **virtual pots**. In production, they become real savings pockets through a digital bank or e-wallet partner.

### Feature 5: Tanya (ask the AI agent)
- **The rider asks in BM:** "Boleh tak saya ambil ansuran telefon RM350 sebulan?" ("Can I afford a RM350/month phone instalment?")
- **The agent answers with real odds:** "78% safe if you work 45 hours a week, 52% if 35 hours."
- **The key rule:** the agent **must call `simulate()`** before giving any answer with a number, so every number comes from the model. It can't make figures up.
- **Agent tools:**

| Tool | What it does |
|---|---|
| `get_forecast()` | Income range for the next 4 weeks |
| `get_salary()` | The current salary amount and why it is that amount |
| `simulate(scenario)` | Re-runs the Monte Carlo with a change (a new instalment, fewer hours, a week off for Raya) |
| `get_pots()` | Balances and targets of the savings pots |
| `explain(topic)` | A 30-second BM lesson using the rider's own numbers |

### Feature 6: Penyata (income statement)
- **The rider taps "Jana Penyata"** (generate statement) and gets a PDF of 3–6 months' income: average, minimum, trend, hours worked.
- **Use it for:** renting a room, phone contracts, microloan applications (TEKUN, cooperatives). Gig workers have no payslip, and this fills that gap.
- **It's an income statement, not a credit score.** That keeps us out of credit-reporting regulation (Credit Reporting Agencies Act 2010).

### Extra: Celik (financial literacy)
- Weekly 30-second BM lessons triggered by the rider's own data:
  - "Commission took 22% of your earnings this week, here's what that means"
  - "Why a 7-day buffer matters"
  - "Flat rate vs effective rate on that phone instalment"
- This covers the brief's literacy goal with lessons that relate to the rider's own situation.

### Language
- The **whole app is in BM and English**, with a toggle. BM input is understood throughout ("minyak", "servis", "ansuran"). This meets the brief's hard requirement and earns the BM NLP bonus.

---

## 6. MVP scope

| Priority | Feature |
|---|---|
| **Must ship (prelim)** | Snap (screenshot extraction for 2 platforms + BM cost entry), Ramal, Gaji salary, Tabung (virtual pots), Tanya agent with `simulate()`, BM/EN toggle |
| **Stretch goals** | Penyata PDF, rain forecast feature, Celik lessons (3), i-Saraan calculator |
| **Explicitly cut** | Moving real money, lending or advances, reading notifications or SMS, native iOS app, blockchain, calling anything a "credit score" |

---

## 7. Architecture and stack

```
 ┌──────────────┐     ┌──────────────────────┐     ┌──────────┐
 │  Rider PWA   │◄───►│   FastAPI backend    │────►│  SQLite  │
 │  (BM / EN)   │     │  screenshot extract  │     └──────────┘
 └──────────────┘     │  BM entry parsing    │
                      └─────────┬────────────┘
                 ┌──────────────┼───────────────┐
                 ▼              ▼               ▼
        ┌────────────────┐ ┌──────────────┐ ┌──────────────────┐
        │ Forecast engine│ │ Salary engine│ │ Tanya agent (LLM)│
        │ LightGBM P10-  │ │ Monte Carlo, │ │ 5 tools; must    │
        │ P90 + calendar │ │ 95% buffer   │ │ call simulate()  │
        │ + MET rain API │ │ constraint   │ │ before answering │
        └────────────────┘ └──────────────┘ └──────────────────┘
                 ▲
        ┌────────────────────────────────┐
        │ Data: real rider screenshots   │
        │ (consented) + synthetic paths  │
        └────────────────────────────────┘
```

| Layer | Tech |
|---|---|
| Frontend | Mobile-first PWA (installable without an app store, works on cheap Android phones) |
| Backend | Python, FastAPI |
| Database | SQLite |
| ML | LightGBM (quantile regression), NumPy (Monte Carlo) |
| AI | An LLM with vision (screenshot extraction) and tool calling (agent) |
| Open data | data.gov.my Weather API (MET Malaysia), public holiday calendar |
| PDF | Any HTML-to-PDF library for Penyata |

---

## 8. Data strategy (our edge)

Most Track 5 teams will use only synthetic data. We use **real** data:
1. **Interview 5–10 riders** (easy to find at any food court or mamak) and collect 8–12 weeks of earnings screenshots **with written consent**, with names and IDs removed.
2. **Use those screenshots** to test the extraction step and **backtest** the forecast, then report the error on a slide.
3. **Add synthetic income paths** (built from the real patterns) for the Monte Carlo and the demo.
4. **Production path:** platform data shared under the Gig Workers Act's PERKESO linkage, or direct platform partnerships.

---

## 9. Judge's evaluation

| Criterion | Weight (prelim / finale) | Score | Reason |
|---|---|---|---|
| **Impact** | 30% / 30% | 9 | 1.6M workers, a new national law, a group named in the brief. Measurable: weeks without running short, RM of i-Saraan matching claimed. |
| **Technical Execution** | 30% / 25% | 9 | Reading earnings from screenshots, quantile forecast with open data, chance-constrained salary optimisation, simulation-checked agent |
| **Usability** | 25% / 25% | 9 | One screenshot a week, one number to remember, all in BM |
| **Feasibility** | 15% / 20% | 8 | No sensitive permissions, no lending or credit licence. Platforms and digital banks both benefit. |
| **Weighted total** | | | **≈ 89 prelim / ≈ 88 finale** (our own estimate, not a guarantee) |

**Comparison with the ideas we dropped:**

| Idea | Est. prelim | Why dropped |
|---|---|---|
| **Coinvoy** | **89** | Chosen |
| Aliran (micro-SME cash-flow + notification capture) | 85 | Not original (Float/Fathom, CTOS alternative scoring); notification permission problems |
| Gig-worker credit score | 67 | Credit-reporting regulation; the real user is a bank officer, so little consumer UX to show |
| Literacy chatbot / budgeting / bookkeeping apps | 59–64 | Crowded; low technical depth |

**What gets us to 90+:**
- Real rider data and quotes from interviews
- A live demo: upload a real screenshot and the salary appears in seconds
- The agent visibly rejecting an unsafe plan in the demo

---

## 10. Hard judge questions and our answers

| Question | Answer |
|---|---|
| Isn't this just a budgeting app? | No. Budgeting apps assume a fixed income. Coinvoy *creates* a fixed income from a variable one, using forecasting and simulation. |
| What if the rider spends the buffer anyway? | The buffer sits in a separate pot. In production that's a locked savings pocket with a bank partner. The app also shows "days of safety left". |
| Screenshots can be faked. | For personal budgeting, faking only hurts the rider. For Penyata, production uses platform-verified data under the Gig Workers Act linkage. |
| How accurate is the forecast? | We backtested it on real rider data. The 95% safety margin is there *because* the forecast is uncertain. |
| Isn't this lending? Do you need a licence? | No lending. The money comes from the rider's own earnings. That's the difference from SteadyPay. |
| Who pays? | Free for riders. Platforms pay as a driver benefit, since it helps keep drivers during driver shortages. Digital banks pay per active saver they gain. |
| Why is this Track 5 and not Track 3? | It's financial inclusion: income stability, savings and proof of income for an underserved group. The brief names gig workers directly. |
| Isn't the AI giving financial advice? | It only reports simulated odds. The rider decides, and a disclaimer is shown. |

---

## 11. Business model

- **Free for gig workers.**
- **B2B2C:**
  1. **Gig platforms:** a "driver financial wellness" benefit that helps with retention and Gig Workers Act compliance.
  2. **Digital banks and e-wallets:** pay per active saver they gain (real savings pockets behind Tabung).
  3. **Microfinance providers (TEKUN, cooperatives):** Penyata gives them proof of income for loan applications.
- **Scaling:** one model serves all platforms. Each new platform only needs one new screenshot parser. Costs are mostly LLM calls (one screenshot per user per week).

---

## 12. Team roles (4 people)

| Role | Owns | Delivers |
|---|---|---|
| **ML lead** | Ramal + Gaji engine | Quantile forecast, Monte Carlo salary optimisation, rain feature, backtest |
| **Backend + AI lead** | API + Snap + Tanya | FastAPI, screenshot extraction, BM parsing, agent with 5 tools, `simulate()` rule |
| **Frontend + UX lead** | PWA | Salary screen, pots, chat, Penyata PDF, BM/EN, screenshots for slides |
| **Product + pitch lead** | Data + story | Rider interviews and screenshot collection (with consent), Celik lessons, i-Saraan and PERKESO facts, slides, video, README |

*With 3 people:* the pitch lead's build work moves to frontend, and everyone helps with slides on days 19–21.

---

## 13. 21-day build plan

> The brief gives no dates, so this assumes 21 days. Adjust once the deadline is confirmed.

### Phase 0 · Days 1–2 · Lock it down
- [ ] Register the team and track; repo and README skeleton
- [ ] Agree the API contract: `Earning`, `Expense`, `Forecast`, `Salary`, `SimulateRequest`, `Pot`
- [ ] Start rider interviews and screenshot collection (pitch lead)

### Phase 1 · Days 3–8 · Rough version end to end
- [ ] Screenshot extraction for 1 platform (backend)
- [ ] Baseline forecast (average of recent weeks) + Monte Carlo salary (ML)
- [ ] PWA: upload → salary screen, with the BM/EN toggle (frontend)
- [ ] **Checkpoint, day 8:** upload a real screenshot and get a salary number

### Phase 2 · Days 9–14 · The actual product
- [ ] LightGBM quantile model + calendar features (ML)
- [ ] 2nd platform parser + BM cost entry (backend)
- [ ] Tanya agent with tools and the `simulate()` rule (backend)
- [ ] Tabung pots UI + chat UI (frontend)
- [ ] **Checkpoint, day 14:** the full Abang Faiz demo runs without help

### Phase 3 · Days 15–18 · Prove it and polish it
- [ ] Backtest on real rider data; record the error (ML)
- [ ] Stretch goals if day 14 passed: Penyata PDF, rain feature, Celik lessons
- [ ] Guardrails, disclaimer, LLM cost cap; deploy to a public URL (backend)
- [ ] Empty and error states, polish (frontend)
- [ ] **Feature freeze at the end of day 18**

### Phase 4 · Days 19–21 · Submit
- [ ] Slides + screenshots
- [ ] Record the 3-minute video (with a backup take)
- [ ] README: setup, architecture, data and consent statement, backtest result
- [ ] Submit with a day to spare; open the repo link from a logged-out browser to check it works

**What to cut first if behind:** rain feature → Celik → Penyata → 2nd platform parser.
**Never cut:** the salary engine, the `simulate()` rule, the BM toggle, real-data backtest.

---

## 14. Slides (the required 6-section structure)

| Slide | Content |
|---|---|
| **1. Project & Team** | Coinvoy, team name, 4 members and roles |
| **2. Problem & Track** | Track 5. 1.64M gig workers, earnings down 30–50%, no savings, no payslip. Gig Workers Act 2025. A quote from an interviewed rider. Why budgeting apps fail. |
| **3. Solution & Value** | Snap → Ramal → Gaji → Tabung, plus Tanya and Penyata. What makes it different: a steady salary without lending, with odds you can check. |
| **4. Technical Implementation** | Architecture diagram, stack, forecast backtest error, how the 95% buffer rule works, open data used |
| **5. UX & Design** | Abang Faiz's journey in 5 steps with phone screenshots |
| **6. Feasibility & Impact** | Business model (platforms, digital banks, microfinance), scaling, measurable outcomes: weeks without running short, buffer size, i-Saraan RM claimed |

---

## 15. 3-minute demo video script

| Time | Scene |
|---|---|
| 0:00–0:25 | **Problem:** Abang Faiz's real earnings swing between RM400 and RM950. His instalment is due, and Raya is coming. "Gaji tak tentu." (His pay is never certain.) |
| 0:25–0:55 | **Snap:** he uploads his weekly earnings screenshot, and the AI reads it in seconds. He types "minyak RM40". |
| 0:55–1:30 | **Ramal + Gaji:** forecast range appears → **"Gaji anda minggu ini: RM620"** ("Your salary this week: RM620"). Show good week → buffer, lean week → top-up. |
| 1:30–2:10 | **Tanya:** "Boleh ambil ansuran telefon RM350?" ("Can I afford a RM350 phone instalment?") → the agent simulates → "52% at 35 hours, 78% at 45 hours". Show it rejecting the unsafe option. |
| 2:10–2:35 | **Tabung + Penyata:** pots, the i-Saraan matching nudge, generating the income statement PDF |
| 2:35–3:00 | **Impact + business model:** 1.6M gig workers, the Gig Workers Act, who pays, next steps |

---

## 16. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Not enough real rider data | Combine what we collect with synthetic paths built from it; state the sample size honestly |
| Screenshot extraction fails on some layouts | Support 2 platforms well; manual correction screen |
| The forecast is no better than a simple average | Show the comparison honestly; the 95% buffer rule still protects the rider |
| The LLM is slow during the demo | Cache the demo run; record a backup take |
| Rain turns out to make little difference | Report it honestly and drop the feature (it's on the cut list anyway) |
| i-Saraan terms change | Check them with EPF before recording |

---

## 17. Open questions

- [ ] What is the actual preliminary deadline, and where do we submit?
- [ ] Are we 3 or 4 people?
- [ ] Which LLM provider and API key, and who pays for it?
- [ ] Which 2 platforms do we support first? (Pick the ones the interviewed riders use.)
- [ ] Rider consent form: who writes it, and how do we store the data safely (PDPA)?

---

## Sources

- [The Star: 1.64M gig workers, earnings down 30–50% (Jul 2026)](https://www.thestar.com.my/business/business-news/2026/07/11/hailstorm-over-rides)
- [NST: Gig Workers Act in force (Mar 2026)](https://www.nst.com.my/amp/news/nation/2026/03/1403257/better-protection-gig-workers-under-new-law)
- [The Sun: i-Saraan and gig workers](https://thesun.my/opinion-news/impact-of-i-saraan-on-gig-workers-CE13242752)
- [SAYS / The Centre: gig workers lack savings](https://says.com/my/news/a-risky-gig-majority-of-m-sian-e-hailing-delivery-drivers-have-no-insurance-or-savings)
- [data.gov.my Weather API](https://developer.data.gov.my/realtime-api/weather)
- [Even: income smoothing (2015)](https://cdbanks.org/node/878)
- [TechCrunch: SteadyPay (UK)](https://techcrunch.com/2022/03/04/london-based-steadypay-helps-freelancers-and-gig-workers-stabilize-their-income)
- [Vulcan Post: Buku 555 app](https://vulcanpost.com/635708/debts-borrow-money-buku-555-app)
- [Khatabook merchant numbers](https://finnsnmarks.substack.com/p/khatabook-bahi-khatas-in-a-digital)
- CODEFEST 2026 brief (`CODEFEST_2026_Brief.md` in this folder)
