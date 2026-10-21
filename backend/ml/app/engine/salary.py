"""The salary solve and scenarios (FR-ENG-4, FR-ENG-5): the one function Gaji, Tanya, Cuti, Semak Layak and Jurang
all call.

The salary is the largest S (in whole ringgit) such that the Penampan stays at or above zero in at least 95% of
1,000 correlated 12-week futures. While the buffer is below its target (2 weeks of essentials) the salary also has
to let the median future reach that target within 8 weeks (FR-GAJI-4).
"""

from dataclasses import dataclass, field, replace
from datetime import date, timedelta

import numpy as np

from app.engine.calendar import bill_due_in_week, weeks_between
from app.engine.forecast import Prior, WeekObs, fit
from app.engine.seasons import multipliers
from app.engine.simulate import buffers, income_paths

HORIZON = 12
N_PATHS = 1000
BLOCK = 4
TARGET = 0.95
BUILD_WEEKS = 8
TARGET_WEEKS_OF_ESSENTIALS = 2
MODEL_VERSIONS = {"shrink": "shrink-bootstrap-v2", "gbm": "gbm-bootstrap-v1"}  # v2: season-adjusted


@dataclass(frozen=True)
class BillIn:
    name: str
    amount_sen: int
    frequency: str
    due_day: int | None = None
    due_date: date | None = None


@dataclass(frozen=True)
class LeaveIn:
    start_week: date
    weeks: int
    set_aside_week_sen: int
    fraction: float = 1.0  # of each week: 1 = a week off, 2/6 = two sick days


@dataclass(frozen=True)
class Scenario:
    """A what-if on top of the rider's real inputs. Empty = the real salary."""

    hours: float | None = None
    add_monthly_sen: int = 0  # e.g. a new instalment, due on the 1st
    one_off_sen: int = 0
    one_off_week: int = 1  # weeks from now
    leaves: tuple[LeaveIn, ...] = ()


@dataclass(frozen=True)
class Inputs:
    week_start: date  # this week (a Monday)
    last_week_net_sen: int  # the income that arrives on this week's payday
    history: tuple[WeekObs, ...]  # oldest first, including last week
    prior: Prior
    planned_hours: float
    buffer_sen: int  # confirmed Penampan only
    cuti_sen: int
    bills: tuple[BillIn, ...] = ()
    leaves: tuple[LeaveIn, ...] = ()
    essentials_week_sen: int = 0
    reserves_week_sen: int = 0  # contributions set aside every week (i-Saraan, PERKESO if not deducted)
    seed: int = 0
    rate_model: str = "shrink"  # "gbm" is the newer model; only switch once it wins the real backtest


@dataclass
class Result:
    salary_sen: int
    p_safe: float
    risk: str
    transfer_sen: int  # this week: positive = move into the pocket, negative = take out
    from_cuti_sen: int  # inside transfer_sen: salary paid from the Cuti pot because last week was leave
    bills_this_week_sen: int
    reserves_this_week_sen: int  # inside transfer_sen, allocated to their pots
    band: dict[str, int]  # weekly income over the next 4 weeks: low (slow week), mid (usual), high (busy week)
    buffer_low_sen: int  # 5th-percentile lowest buffer over the horizon, at this salary
    build_up: dict | None
    jurang: dict | None
    cold_start: bool
    weeks_used: int
    own_residuals: bool
    bills_next_week: list[str] = field(default_factory=list)
    bills_soon_sen: int = 0
    set_aside_soon_sen: int = 0
    model_version: str = MODEL_VERSIONS["shrink"]

    def as_dict(self) -> dict:
        return dict(self.__dict__)


def risk_word(p: float) -> str:
    """FR-ADV-3 thresholds."""
    return "selamat" if p >= 0.90 else "berhati" if p >= 0.70 else "berisiko"


@dataclass
class _Plan:
    """Everything deterministic about the next 12 weeks."""

    outflows: np.ndarray  # sen leaving the Penampan each step (bills, reserves, set-asides, one-offs)
    bills: np.ndarray
    reserves: np.ndarray  # contributions + leave set-asides (they go into the pocket, but not the Penampan)
    cuti_in: np.ndarray
    cuti_pays: np.ndarray  # steps where the salary comes from the Cuti pot
    hours: np.ndarray  # planned hours behind steps 1..12 (0 in leave weeks)
    bill_names_next_week: list[str]


def _plan(inp: Inputs, sc: Scenario) -> _Plan:
    bills = list(inp.bills)
    if sc.add_monthly_sen:
        bills.append(BillIn("scenario", sc.add_monthly_sen, "monthly", due_day=1))
    leaves = inp.leaves + sc.leaves
    weeks = [inp.week_start + timedelta(weeks=t) for t in range(HORIZON)]

    bill_sen = np.array([sum(b.amount_sen for b in bills if bill_due_in_week(b.frequency, b.due_day, b.due_date, w))
                         for w in weeks], dtype=float)
    on_leave = np.zeros(HORIZON + 1)  # share of each calendar week off; index 0 = last week
    cuti_in = np.zeros(HORIZON)
    for lv in leaves:
        start = weeks_between(inp.week_start, lv.start_week)
        span = on_leave[max(start + 1, 0):max(start + lv.weeks + 1, 0)]
        span[:] = np.minimum(1.0, span + lv.fraction)
        cuti_in[:max(min(start, HORIZON), 0)] += lv.set_aside_week_sen
    reserves = cuti_in + inp.reserves_week_sen
    one_off = np.zeros(HORIZON)
    if sc.one_off_sen and 0 <= sc.one_off_week < HORIZON:
        one_off[sc.one_off_week] = sc.one_off_sen

    hours = np.full(HORIZON - 1, float(sc.hours if sc.hours is not None else inp.planned_hours))
    hours *= 1 - on_leave[1:HORIZON]  # step t's income was earned in week t-1
    hours *= multipliers(weeks[:HORIZON - 1])  # Ramadan, holidays, school holidays in the week it was earned
    cuti_pays = on_leave[:HORIZON]  # step 0 pays from Cuti when last week was leave
    next_week = weeks[1]
    names = [b.name for b in bills if b.name != "scenario"
             and bill_due_in_week(b.frequency, b.due_day, b.due_date, next_week)]
    return _Plan(bill_sen + reserves + one_off, bill_sen, reserves, cuti_in, cuti_pays, hours, names)


def _income(inp: Inputs, plan: _Plan) -> np.ndarray:
    fc = fit(list(inp.history), inp.prior, inp.planned_hours, inp.rate_model)
    rng = np.random.default_rng(inp.seed)
    future = income_paths(fc, plan.hours, N_PATHS, BLOCK, rng)
    return np.hstack([np.full((N_PATHS, 1), float(inp.last_week_net_sen)), future]), fc


def _solve(inp: Inputs, plan: _Plan, income: np.ndarray, with_build_up: bool = True) -> tuple[int, float, np.ndarray]:
    target = TARGET_WEEKS_OF_ESSENTIALS * inp.essentials_week_sen
    build_up = with_build_up and inp.buffer_sen < target

    def run(s: int) -> np.ndarray:
        return buffers(inp.buffer_sen, income, s, plan.outflows, plan.cuti_pays, inp.cuti_sen, plan.cuti_in)

    def ok(s: int) -> bool:
        b = run(s)
        safe = (b.min(axis=1) >= 0).mean() >= TARGET
        return safe and (not build_up or np.median(b[:, BUILD_WEEKS - 1]) >= target)

    hi = (inp.buffer_sen + inp.last_week_net_sen + int(np.percentile(income[:, 1:], 90)) * 2) // 100 + 1
    lo = 0
    if not ok(0):
        b = run(0)
        return 0, float((b.min(axis=1) >= 0).mean()), b
    while lo < hi:  # largest whole-ringgit S with ok(S)
        mid = (lo + hi + 1) // 2
        lo, hi = (mid, hi) if ok(mid * 100) else (lo, mid - 1)
    b = run(lo * 100)
    return lo * 100, float((b.min(axis=1) >= 0).mean()), b


def solve(inp: Inputs, sc: Scenario = Scenario()) -> Result:
    plan = _plan(inp, sc)
    income, fc = _income(inp, plan)
    salary, p_safe, b = _solve(inp, plan, income)

    target = TARGET_WEEKS_OF_ESSENTIALS * inp.essentials_week_sen
    build_up = None
    if inp.buffer_sen < target:
        richer = replace(inp, buffer_sen=inp.buffer_sen + 10_000)
        build_up = {"target_sen": target, "buffer_sen": inp.buffer_sen,
                    "per_100_sen": _solve(richer, plan, income)[0] - salary}
    # Jurang is about low income, not the saving phase: compare essentials with the safe salary before the
    # build-up hold-back, so a rider who earns enough isn't told they're short while their buffer fills.
    safe = _solve(inp, plan, income, with_build_up=False)[0] if build_up else salary
    jurang = None
    if inp.essentials_week_sen and safe < inp.essentials_week_sen:
        jurang = {"essentials_sen": inp.essentials_week_sen, "gap_sen": inp.essentials_week_sen - safe}

    from_cuti = int(min(salary * plan.cuti_pays[0], inp.cuti_sen + plan.cuti_in[0]))
    nxt = income[:, 1:5]
    return Result(
        salary_sen=salary,
        p_safe=round(p_safe, 3),
        risk=risk_word(p_safe),
        transfer_sen=inp.last_week_net_sen - salary - int(plan.bills[0]) + from_cuti,
        from_cuti_sen=from_cuti,
        bills_this_week_sen=int(plan.bills[0]),
        reserves_this_week_sen=int(plan.reserves[0]),
        band={k: int(np.percentile(nxt[nxt > 0], q)) if (nxt > 0).any() else 0
              for k, q in (("low", 10), ("mid", 50), ("high", 90))},
        buffer_low_sen=int(np.percentile(b.min(axis=1), 5)),
        build_up=build_up,
        jurang=jurang,
        cold_start=fc.cold_start,
        weeks_used=fc.weeks_used,
        own_residuals=fc.own_residuals,
        bills_next_week=plan.bill_names_next_week,
        bills_soon_sen=int(plan.bills[:4].sum()),
        set_aside_soon_sen=int(plan.cuti_in[:4].sum()),
        model_version=MODEL_VERSIONS[inp.rate_model],
    )


def p_safe_at(inp: Inputs, salary_sen: int, sc: Scenario) -> float:
    """How safe the current salary stays under a what-if (Tanya, Semak Layak, Cuti preview)."""
    plan = _plan(inp, sc)
    income, _ = _income(inp, plan)
    b = buffers(inp.buffer_sen, income, salary_sen, plan.outflows, plan.cuti_pays, inp.cuti_sen, plan.cuti_in)
    return round(float((b.min(axis=1) >= 0).mean()), 3)
