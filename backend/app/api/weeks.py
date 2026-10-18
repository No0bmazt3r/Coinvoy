"""Earnings weeks (FR-SNAP-2/3/5, FR-ONB-5) and the bills calendar (FR-ONB-4)."""

from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.engine.calendar import today_kl, week_start
from app.errors import api_error
from app.models import Bill, Earning, Event, User
from app.schemas import BillBody, EarningIn, WeeksIn
from app.services.salary import recompute

router = APIRouter(prefix="/api", tags=["weeks"])


def _not_found():
    return api_error(404, "not_found", "Tidak dijumpai.", "Not found.")


def earning_json(e: Earning) -> dict:
    return {"id": e.id, "weekStart": e.week_start.isoformat(), "platform": e.platform, "grossSen": e.gross_sen,
            "commissionSen": e.commission_sen, "incentivesSen": e.incentives_sen, "tipsSen": e.tips_sen,
            "netSen": e.net_sen, "trips": e.trips, "hoursOnline": e.hours_online, "source": e.source,
            "verification": e.verification}


def bill_json(b: Bill) -> dict:
    return {"id": b.id, "name": b.name, "amountSen": b.amount_sen, "frequency": b.frequency, "dueDay": b.due_day,
            "dueDate": b.due_date.isoformat() if b.due_date else None, "active": b.active}


def _upsert(db: Session, user: User, monday, row: EarningIn) -> None:
    e = db.scalar(select(Earning).where(Earning.user_id == user.id, Earning.week_start == monday,
                                        Earning.platform == row.platform))
    if e is None:
        e = Earning(user_id=user.id, week_start=monday, platform=row.platform, gross_sen=0)
        db.add(e)
    for field, value in row.model_dump().items():
        setattr(e, field, value)
    e.verification = "self"  # a re-entered figure is self-reported again until cross-checked


@router.post("/weeks/confirm")
def confirm_weeks(body: WeeksIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Nothing from Snap is saved until the rider confirms it here (FR-SNAP-2)."""
    this_week = week_start(today_kl())
    for wk in body.weeks:
        if wk.week_start.weekday() != 0 or wk.week_start > this_week or wk.week_start < this_week - timedelta(
                weeks=104):
            raise api_error(422, "bad_week", "Minggu tidak sah.", "That week isn't valid.")
        for row in wk.platforms:
            _upsert(db, user, wk.week_start, row)
        db.add(Event(user_id=user.id, name="week_logged",
                     props={"week": wk.week_start.isoformat(), "source": wk.platforms[0].source}))
    db.flush()
    recompute(db, user)
    db.commit()
    return {"ok": True}


@router.get("/weeks")
def list_weeks(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    weeks: dict = defaultdict(list)
    for e in db.scalars(select(Earning).where(Earning.user_id == user.id).order_by(Earning.week_start.desc())):
        weeks[e.week_start].append(e)
    return {"weeks": [{"weekStart": wk.isoformat(), "netSen": sum(e.net_sen for e in rows),
                       "hours": sum(e.hours_online or 0 for e in rows) or None,
                       "verification": "checked" if all(e.verification != "self" for e in rows) else "self",
                       "platforms": [earning_json(e) for e in rows]} for wk, rows in weeks.items()]}


@router.patch("/earnings/{earning_id}")
def edit_earning(earning_id: int, body: EarningIn, user: User = Depends(current_user),
                 db: Session = Depends(get_db)) -> dict:
    e = db.scalar(select(Earning).where(Earning.id == earning_id, Earning.user_id == user.id))
    if e is None:
        raise _not_found()
    _upsert(db, user, e.week_start, body)
    db.flush()
    recompute(db, user)
    db.commit()
    return {"earning": earning_json(e)}


@router.delete("/earnings/{earning_id}", status_code=204)
def delete_earning(earning_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    e = db.scalar(select(Earning).where(Earning.id == earning_id, Earning.user_id == user.id))
    if e is None:
        raise _not_found()
    db.delete(e)
    db.flush()
    recompute(db, user)
    db.commit()


@router.get("/bills")
def list_bills(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return {"bills": [bill_json(b) for b in db.scalars(select(Bill).where(Bill.user_id == user.id).order_by(Bill.id))]}


@router.post("/bills", status_code=201)
def add_bill(body: BillBody, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    bill = Bill(user_id=user.id, **body.model_dump())
    db.add(bill)
    db.flush()
    recompute(db, user)
    db.commit()
    return {"bill": bill_json(bill)}


@router.patch("/bills/{bill_id}")
def edit_bill(bill_id: int, body: BillBody, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    bill = db.scalar(select(Bill).where(Bill.id == bill_id, Bill.user_id == user.id))
    if bill is None:
        raise _not_found()
    for field, value in body.model_dump().items():
        setattr(bill, field, value)
    db.flush()
    recompute(db, user)
    db.commit()
    return {"bill": bill_json(bill)}


@router.delete("/bills/{bill_id}", status_code=204)
def delete_bill(bill_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    bill = db.scalar(select(Bill).where(Bill.id == bill_id, Bill.user_id == user.id))
    if bill is None:
        raise _not_found()
    db.delete(bill)
    db.flush()
    recompute(db, user)
    db.commit()
