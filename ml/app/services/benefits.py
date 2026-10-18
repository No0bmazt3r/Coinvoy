"""Cuti Berbayar, Caruman, check-ins, and streaks (FR-CUTI-*, FR-CAR-*, FR-GAJI-5, FR-STRK-*)."""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.engine.calendar import today_kl, week_start, weeks_between
from app.engine.salary import LeaveIn, Scenario, solve
from app.models import (
    Badge,
    Checkin,
    Contribution,
    Earning,
    LeavePlan,
    StreakFreeze,
    Transfer,
    User,
)
from app.services.pots import ensure_pots
from app.services.salary import build_inputs, current_week

# Streak length → level (FR-STRK-4). Cosmetic only: a title and an accent colour, never a feature.
LEVELS = (0, 4, 8, 16, 26)
ACCENTS = ("lime", "aqua", "amber", "pink", "sky")
MANUAL_FREEZES_PER_QUARTER = 2


def leave_preview(db: Session, user: User, start_week: date, weeks: int) -> dict | None:
    """How much to set aside each week until the leave, and what that does to the salary (FR-CUTI-1)."""
    run_week = current_week(db, user.id)
    inp = build_inputs(db, user, run_week)
    if inp is None:
        return None
    until = weeks_between(run_week, start_week)
    now = solve(inp)
    # Enough set aside by the leave to pay this salary for every week off.
    set_aside = -(-now.salary_sen * weeks // max(until, 1) // 100) * 100
    planned = solve(inp, Scenario(leaves=(LeaveIn(start_week, weeks, set_aside),)))
    return {"weeksUntil": until, "setAsideWeekSen": set_aside, "salarySen": planned.salary_sen,
            "salaryDeltaSen": planned.salary_sen - now.salary_sen, "pSafe": planned.p_safe, "risk": planned.risk}


def sick_status(db: Session, user: User) -> dict:
    year_start = date(today_kl().year, 1, 1)
    used = db.scalar(select(func.coalesce(func.sum(LeavePlan.days), 0)).where(
        LeavePlan.user_id == user.id, LeavePlan.kind == "sick", LeavePlan.status != "cancelled",
        LeavePlan.start_week >= week_start(year_start))) or 0
    return {"daysCovered": user.sick_days_covered, "daysUsed": int(used)}


def contribute_isaraan(db: Session, user: User, amount_sen: int) -> Contribution:
    """The rider paid into i-Saraan from their pocket; the government match is capped per year (FR-CAR-2/3)."""
    year = today_kl().year
    matched = db.scalar(select(func.coalesce(func.sum(Contribution.match_sen), 0)).where(
        Contribution.user_id == user.id, Contribution.kind == "isaraan", Contribution.year == year)) or 0
    match = max(0, min(round(amount_sen * settings.isaraan_match_rate), settings.isaraan_match_cap_sen - matched))
    pot = ensure_pots(db, user.id)["isaraan"]
    pot.balance_sen -= min(pot.balance_sen, amount_sen)  # it left the pocket for EPF
    row = Contribution(user_id=user.id, kind="isaraan", amount_sen=amount_sen, match_sen=match, year=year)
    db.add(row)
    return row


def caruman(db: Session, user: User) -> dict:
    year = today_kl().year
    rows = list(db.scalars(select(Contribution).where(Contribution.user_id == user.id)))
    this_year = [r for r in rows if r.year == year]
    paid = sum(r.amount_sen for r in this_year)
    full_match_needs = round(settings.isaraan_match_cap_sen / settings.isaraan_match_rate)
    return {
        "isaraan": {"rate": settings.isaraan_match_rate, "capSen": settings.isaraan_match_cap_sen,
                    "paidYearSen": paid, "matchYearSen": sum(r.match_sen for r in this_year),
                    "fullMatchNeedsSen": full_match_needs, "leftForFullMatchSen": max(0, full_match_needs - paid),
                    "weeklySen": ensure_pots(db, user.id)["isaraan"].weekly_sen},
        "perkeso": {"deductedAtSource": settings.perkeso_deducted_at_source, "rate": settings.perkeso_rate},
        "governmentClaimedSen": sum(r.match_sen for r in rows),
    }


def checkin_due(db: Session, user_id: int) -> str | None:
    """Ask about last week once the rider had a salary for it (FR-GAJI-5)."""
    last_week = week_start(today_kl()) - timedelta(weeks=1)
    had_salary = db.scalar(select(Transfer.id).where(Transfer.user_id == user_id, Transfer.week_start == last_week))
    answered = db.scalar(select(Checkin.id).where(Checkin.user_id == user_id, Checkin.week_start == last_week))
    return last_week.isoformat() if had_salary and not answered else None


def _frozen_weeks(db: Session, user_id: int) -> set[date]:
    frozen = set(db.scalars(select(StreakFreeze.week_start).where(StreakFreeze.user_id == user_id)))
    for lv in db.scalars(select(LeavePlan).where(LeavePlan.user_id == user_id, LeavePlan.status != "cancelled")):
        frozen |= {lv.start_week + timedelta(weeks=i) for i in range(lv.weeks)}
    return frozen


def streak(db: Session, user: User) -> dict:
    """Consecutive logged weeks back from last week. Leave, sick and manual-freeze weeks neither add nor break it
    (FR-STRK-1/6). Only weeks logged, transfers confirmed and Gaji kept count: never hours or trips."""
    logged = set(db.scalars(select(Earning.week_start).where(Earning.user_id == user.id).distinct()))
    frozen = _frozen_weeks(db, user.id)
    this_week = week_start(today_kl())
    week = this_week - timedelta(weeks=1)
    at_risk = week not in logged and week not in frozen
    if at_risk:
        week -= timedelta(weeks=1)  # last week can still be logged; count from the week before
    count = 0
    first = min(logged, default=this_week)
    while week >= first:
        if week in logged:
            count += 1
        elif week not in frozen:
            break
        week -= timedelta(weeks=1)
    if this_week in logged:
        count += 1
    level = sum(count >= t for t in LEVELS) - 1
    q_start = date(this_week.year, 3 * ((this_week.month - 1) // 3) + 1, 1)
    used = db.scalar(select(func.count()).select_from(StreakFreeze).where(
        StreakFreeze.user_id == user.id, StreakFreeze.week_start >= week_start(q_start))) or 0
    return {
        "weeks": count,
        "atRisk": at_risk and count > 0,
        "frozenThisWeek": (this_week in frozen) or (this_week - timedelta(weeks=1) in frozen),
        "level": level,
        "nextLevelAt": LEVELS[level + 1] if level + 1 < len(LEVELS) else None,
        "accents": list(ACCENTS[: level + 1]),
        "transfersConfirmed": db.scalar(select(func.count()).select_from(Transfer).where(
            Transfer.user_id == user.id, Transfer.status.in_(("confirmed", "partial")))) or 0,
        "gajiKept": db.scalar(select(func.count()).select_from(Checkin).where(
            Checkin.user_id == user.id, Checkin.answer == "ya")) or 0,
        "freezesLeft": max(0, MANUAL_FREEZES_PER_QUARTER - used),
    }


def refresh_badges(db: Session, user: User, streak_weeks: int) -> list[dict]:
    """Milestones for real progress, awarded from data, never from app opens (FR-STRK-5)."""
    have = {b.kind: b for b in db.scalars(select(Badge).where(Badge.user_id == user.id))}
    pots = ensure_pots(db, user.id)
    target = 2 * (user.essentials_week_sen or 0)
    earned = {
        "minggu_pertama": db.scalar(select(Earning.id).where(Earning.user_id == user.id)) is not None,
        "pindah_pertama": db.scalar(select(Transfer.id).where(
            Transfer.user_id == user.id, Transfer.status.in_(("confirmed", "partial")))) is not None,
        "penampan_penuh": target > 0 and pots["penampan"].balance_sen >= target,
        "cuti_pertama": db.scalar(select(LeavePlan.id).where(
            LeavePlan.user_id == user.id, LeavePlan.kind == "planned", LeavePlan.status != "cancelled",
            LeavePlan.start_week < week_start(today_kl()))) is not None,
        "isaraan_dituntut": db.scalar(select(Contribution.id).where(
            Contribution.user_id == user.id, Contribution.match_sen > 0)) is not None,
        "konsisten_4": streak_weeks >= 4,
        "konsisten_12": streak_weeks >= 12,
    }
    for kind, ok in earned.items():
        if ok and kind not in have:
            have[kind] = Badge(user_id=user.id, kind=kind)
            db.add(have[kind])
    db.flush()
    return [{"kind": b.kind, "at": b.created_at.isoformat() + "Z"} for b in sorted(have.values(), key=lambda b: b.id)]
