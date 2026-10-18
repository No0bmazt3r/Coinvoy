"""Cuti, Caruman, check-ins and streaks (FR-CUTI-*, FR-CAR-*, FR-GAJI-5, FR-STRK-*)."""

from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.engine.calendar import today_kl, week_start
from app.errors import api_error
from app.models import Checkin, Event, LeavePlan, StreakFreeze, User
from app.schemas import CheckinIn, ContributionIn, FreezeIn, LeaveBody, SickIn
from app.services import benefits
from app.services.salary import current_week, recompute

router = APIRouter(prefix="/api", tags=["benefits"])


def _bad(code: str, ms: str, en: str):
    return api_error(422, code, ms, en)


def leave_json(lv: LeavePlan) -> dict:
    return {"id": lv.id, "kind": lv.kind, "label": lv.label, "startWeek": lv.start_week.isoformat(), "weeks": lv.weeks,
            "days": lv.days, "setAsideWeekSen": lv.set_aside_week_sen, "status": lv.status}


def _check_leave(db: Session, user: User, body: LeaveBody) -> None:
    until = (body.start_week - current_week(db, user.id)).days // 7
    if body.start_week.weekday() != 0 or not 1 <= until <= 52:
        raise _bad("bad_leave_week", "Rancang cuti sekurang-kurangnya seminggu lebih awal, dalam tempoh setahun.",
                   "Plan leave at least a week ahead, within a year.")


@router.post("/leave/preview")
def preview(body: LeaveBody, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    _check_leave(db, user, body)
    result = benefits.leave_preview(db, user, body.start_week, body.weeks)
    if result is None:
        raise _bad("no_salary_yet", "Snap pendapatan dahulu.", "Snap your earnings first.")
    return result


@router.post("/leave", status_code=201)
def plan_leave(body: LeaveBody, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    _check_leave(db, user, body)
    p = benefits.leave_preview(db, user, body.start_week, body.weeks)
    if p is None:
        raise _bad("no_salary_yet", "Snap pendapatan dahulu.", "Snap your earnings first.")
    lv = LeavePlan(user_id=user.id, kind="planned", label=body.label, start_week=body.start_week, weeks=body.weeks,
                   set_aside_week_sen=p["setAsideWeekSen"])
    db.add(lv)
    db.flush()
    recompute(db, user)
    db.commit()
    return {"leave": leave_json(lv)}


@router.post("/leave/sick", status_code=201)
def sick(body: SickIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """"Saya sakit minggu ini": the Cuti pot pays for the days off, and the streak freezes (FR-CUTI-3/4)."""
    this_week = week_start(today_kl())
    lv = db.scalar(select(LeavePlan).where(LeavePlan.user_id == user.id, LeavePlan.kind == "sick",
                                           LeavePlan.start_week == this_week, LeavePlan.status != "cancelled"))
    if lv is None:
        lv = LeavePlan(user_id=user.id, kind="sick", start_week=this_week, weeks=1)
        db.add(lv)
    lv.days = body.days
    db.add(Event(user_id=user.id, name="sick_week", props={"days": body.days}))
    db.flush()
    recompute(db, user)
    db.commit()
    return {"leave": leave_json(lv)}


@router.get("/leave")
def list_leave(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    plans = db.scalars(select(LeavePlan).where(LeavePlan.user_id == user.id, LeavePlan.status != "cancelled")
                       .order_by(LeavePlan.start_week.desc()))
    return {"leave": [leave_json(lv) for lv in plans], "sick": benefits.sick_status(db, user)}


@router.delete("/leave/{leave_id}", status_code=204)
def cancel_leave(leave_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    lv = db.scalar(select(LeavePlan).where(LeavePlan.id == leave_id, LeavePlan.user_id == user.id))
    if lv is None:
        raise api_error(404, "not_found", "Tidak dijumpai.", "Not found.")
    lv.status = "cancelled"
    db.flush()
    recompute(db, user)
    db.commit()


@router.get("/caruman")
def get_caruman(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    data = benefits.caruman(db, user)
    db.commit()
    return data


@router.post("/caruman/isaraan", status_code=201)
def isaraan(body: ContributionIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = benefits.contribute_isaraan(db, user, body.amount_sen)
    db.add(Event(user_id=user.id, name="isaraan_match_earned", props={"match_sen": row.match_sen}))
    db.commit()
    return {"matchSen": row.match_sen, **benefits.caruman(db, user)}


@router.post("/checkins")
def checkin(body: CheckinIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.scalar(select(Checkin).where(Checkin.user_id == user.id, Checkin.week_start == body.week_start))
    if row is None:
        row = Checkin(user_id=user.id, week_start=body.week_start, answer=body.answer)
        db.add(row)
    row.answer = body.answer
    db.add(Event(user_id=user.id, name="checkin", props={"answer": body.answer}))
    db.commit()
    return {"ok": True}


@router.get("/streak")
def get_streak(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    s = benefits.streak(db, user)
    badges = benefits.refresh_badges(db, user, s["weeks"])
    db.commit()
    return {**s, "badges": badges}


@router.post("/streak/freeze", status_code=201)
def freeze(body: FreezeIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    this_week = week_start(today_kl())
    if body.week_start.weekday() != 0 or not this_week - timedelta(weeks=1) <= body.week_start <= this_week:
        raise _bad("bad_week", "Hanya minggu ini atau minggu lepas.", "Only this week or last week.")
    if benefits.streak(db, user)["freezesLeft"] < 1:
        raise _bad("no_freezes", "Tiada pembekuan lagi suku tahun ini.", "No freezes left this quarter.")
    if not db.scalar(select(StreakFreeze.id).where(StreakFreeze.user_id == user.id,
                                                   StreakFreeze.week_start == body.week_start)):
        db.add(StreakFreeze(user_id=user.id, week_start=body.week_start))
    db.commit()
    return benefits.streak(db, user)
