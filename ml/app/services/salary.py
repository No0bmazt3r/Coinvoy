"""Loads a rider's data, runs the engine, and saves the result (architecture §5.3)."""

import hashlib
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.engine import explain
from app.engine.calendar import today_kl, week_start
from app.engine.forecast import WeekObs, prior_for
from app.engine.salary import MODEL_VERSION, BillIn, Inputs, LeaveIn, Result, Scenario, solve
from app.models import Bill, Earning, LeavePlan, SalaryRun, Transfer, User, UserPlatform
from app.services.pots import ensure_pots


def seed_for(user_id: int, week: date) -> int:
    """Same rider + same week = same 1,000 futures, so the salary doesn't jitter on every reload (FR-ENG-2)."""
    return int.from_bytes(hashlib.sha256(f"{user_id}:{week.isoformat()}".encode()).digest()[:8], "big")


def weekly_history(db: Session, user_id: int) -> list[tuple[date, int, float | None]]:
    """(week_start, net_sen, hours) per logged week, oldest first; platforms combined (FR-SNAP-3)."""
    weeks: dict[date, list[Earning]] = defaultdict(list)
    for e in db.scalars(select(Earning).where(Earning.user_id == user_id)):
        weeks[e.week_start].append(e)
    out = []
    for wk in sorted(weeks):
        rows = weeks[wk]
        hours = [r.hours_online for r in rows if r.hours_online is not None]
        out.append((wk, sum(r.net_sen for r in rows), sum(hours) if hours else None))
    return out


def platforms_of(db: Session, user_id: int) -> list[str]:
    query = select(UserPlatform.platform).where(UserPlatform.user_id == user_id).order_by(UserPlatform.id)
    return list(db.scalars(query))


def build_inputs(db: Session, user: User, run_week: date) -> Inputs | None:
    """Inputs for the salary of run_week, whose payday brings in the week before it. None = nothing logged yet."""
    history = [h for h in weekly_history(db, user.id) if h[0] < run_week]
    if not history:
        return None
    prior = prior_for(platforms_of(db, user.id), user.city)
    recent_hours = [h for _, _, h in history[-4:] if h]
    planned = user.default_hours or (sum(recent_hours) / len(recent_hours) if recent_hours else prior.default_hours)
    last_week = run_week - timedelta(weeks=1)
    last_net = next((net for wk, net, _ in history if wk == last_week), 0)
    pots = ensure_pots(db, user.id)
    bills = tuple(BillIn(b.name, b.amount_sen, b.frequency, b.due_day, b.due_date)
                  for b in db.scalars(select(Bill).where(Bill.user_id == user.id, Bill.active)))
    leaves = tuple(LeaveIn(lv.start_week, lv.weeks, lv.set_aside_week_sen, (lv.days or 6) / 6) for lv in db.scalars(
        select(LeavePlan).where(LeavePlan.user_id == user.id, LeavePlan.status != "cancelled",
                                LeavePlan.start_week >= run_week - timedelta(weeks=13))))
    reserves = (sum(p.weekly_sen for k, p in pots.items() if k != "penampan") + perkeso_reserve(last_net)
                + sick_reserve(user))
    return Inputs(
        week_start=run_week,
        last_week_net_sen=last_net,
        history=tuple(WeekObs(net, hours) for _, net, hours in history),
        prior=prior,
        planned_hours=float(planned),
        buffer_sen=pots["penampan"].balance_sen,
        cuti_sen=pots["cuti"].balance_sen,
        bills=bills,
        leaves=leaves,
        essentials_week_sen=user.essentials_week_sen or 0,
        reserves_week_sen=reserves,
        seed=seed_for(user.id, run_week),
    )


def sick_reserve(user: User) -> int:
    """A weekly set-aside into Cuti that pays for the sick days covered (3 a year by default, FR-CUTI-3).
    A day is a sixth of a week's essentials."""
    return round((user.essentials_week_sen or 0) / 6 * user.sick_days_covered / 52)


def perkeso_reserve(net_sen: int) -> int:
    """Only reserved when platforms don't already deduct it at source (FR-CAR-1)."""
    return 0 if settings.perkeso_deducted_at_source else round(settings.perkeso_rate * net_sen)


def current_week(db: Session, user_id: int) -> date:
    """The week whose salary the rider is on: the week after the latest logged week, but never in the past."""
    history = weekly_history(db, user_id)
    this_week = week_start(today_kl())
    return max(history[-1][0] + timedelta(weeks=1), this_week) if history else this_week


def run_scenario(db: Session, user: User, sc: Scenario) -> tuple[Inputs, Result] | None:
    inp = build_inputs(db, user, current_week(db, user.id))
    return (inp, solve(inp, sc)) if inp else None


def recompute(db: Session, user: User) -> SalaryRun | None:
    """Re-run the salary for the current week, keep the explanation, and refresh this week's transfer."""
    run_week = current_week(db, user.id)
    inp = build_inputs(db, user, run_week)
    if inp is None:
        return None
    res = solve(inp)
    cur = res.as_dict()
    prev = db.scalar(select(SalaryRun).where(SalaryRun.user_id == user.id, SalaryRun.week_start < run_week)
                     .order_by(SalaryRun.week_start.desc()))
    cur["factors"] = explain.diff(prev.result | {"salary_sen": prev.salary_sen} if prev else None, cur)
    cur["planned_hours"] = inp.planned_hours
    cur["salary_delta_sen"] = res.salary_sen - prev.salary_sen if prev else None

    run = db.scalar(select(SalaryRun).where(SalaryRun.user_id == user.id, SalaryRun.week_start == run_week))
    if run is None:
        run = SalaryRun(user_id=user.id, week_start=run_week)
        db.add(run)
    run.salary_sen, run.p_safe, run.risk = res.salary_sen, res.p_safe, res.risk
    run.buffer_start_sen, run.result = inp.buffer_sen, cur
    run.model_version, run.seed = MODEL_VERSION, inp.seed
    _refresh_transfer(db, user.id, run_week, res, perkeso_reserve(inp.last_week_net_sen), sick_reserve(user))
    db.flush()
    return run


def _refresh_transfer(db: Session, user_id: int, week: date, res: Result, perkeso_sen: int, sick_sen: int) -> None:
    """A confirmed transfer is history and is never rewritten; a pending one follows the latest run."""
    t = db.scalar(select(Transfer).where(Transfer.user_id == user_id, Transfer.week_start == week))
    if t and t.status != "pending":
        return
    pots = ensure_pots(db, user_id)
    allocation = {k: p.weekly_sen for k, p in pots.items() if k != "penampan" and p.weekly_sen}
    if perkeso_sen:
        allocation["perkeso"] = allocation.get("perkeso", 0) + perkeso_sen
    if sick_sen:
        allocation["cuti"] = allocation.get("cuti", 0) + sick_sen
    leave_set_aside = res.reserves_this_week_sen - sum(allocation.values())
    if leave_set_aside or res.from_cuti_sen:
        allocation["cuti"] = allocation.get("cuti", 0) + leave_set_aside - res.from_cuti_sen
    allocation["penampan"] = res.transfer_sen - sum(allocation.values())
    if res.transfer_sen == 0:
        if t:
            db.delete(t)
        return
    if t is None:
        t = Transfer(user_id=user_id, week_start=week, direction="in", amount_sen=0, allocation={})
        db.add(t)
    t.direction = "in" if res.transfer_sen > 0 else "out"
    t.amount_sen = abs(res.transfer_sen)
    t.allocation = {k: v for k, v in allocation.items() if v}
