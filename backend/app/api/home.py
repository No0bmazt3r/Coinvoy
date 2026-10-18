"""The home screen in one call (FR-GAJI-1), the weekly transfer (FR-GAJI-2/3) and pots."""

from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.engine.calendar import today_kl, week_start
from app.errors import api_error
from app.models import Pot, SalaryRun, Transfer, User
from app.schemas import PotIn, TransferConfirmIn, camel
from app.services.benefits import checkin_due, streak
from app.services.pots import POT_KINDS, confirm_transfer, ensure_pots
from app.services.salary import current_week, recompute, weekly_history

router = APIRouter(prefix="/api", tags=["home"])


def transfer_json(t: Transfer | None) -> dict | None:
    if t is None:
        return None
    return {"id": t.id, "weekStart": t.week_start.isoformat(), "direction": t.direction, "amountSen": t.amount_sen,
            "allocation": t.allocation, "status": t.status, "confirmedAmountSen": t.confirmed_amount_sen,
            "confirmedAt": t.confirmed_at.isoformat() + "Z" if t.confirmed_at else None,
            "verification": t.verification}


def pot_json(p: Pot) -> dict:
    return {"kind": p.kind, "balanceSen": p.balance_sen, "targetSen": p.target_sen, "weeklySen": p.weekly_sen}


@router.get("/home")
def home(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    history = weekly_history(db, user.id)
    this_week = week_start(today_kl())
    run_week = current_week(db, user.id)
    run = db.scalar(select(SalaryRun).where(SalaryRun.user_id == user.id, SalaryRun.week_start == run_week))
    if run is None:  # weeks logged but the latest salary is from an earlier week: show that one
        run = db.scalar(select(SalaryRun).where(SalaryRun.user_id == user.id)
                        .order_by(SalaryRun.week_start.desc()))
    transfer = run and db.scalar(select(Transfer).where(Transfer.user_id == user.id,
                                                        Transfer.week_start == run.week_start))
    pots = ensure_pots(db, user.id)
    db.commit()
    last_logged = history[-1][0] if history else None
    salary = None
    if run:
        r = run.result
        salary = camel({"week_start": run.week_start.isoformat(), "salary_sen": run.salary_sen,
                        "p_safe": run.p_safe, "risk": run.risk, "factors": r.get("factors", []), "band": r["band"],
                        "build_up": r["build_up"], "jurang": r["jurang"], "cold_start": r["cold_start"],
                        "weeks_used": r["weeks_used"], "planned_hours": r.get("planned_hours"),
                        "from_cuti_sen": r.get("from_cuti_sen", 0), "bills_this_week_sen": r["bills_this_week_sen"],
                        "salary_delta_sen": r.get("salary_delta_sen")})
    return {
        "salary": salary,
        "transfer": transfer_json(transfer),
        "buffer": pot_json(pots["penampan"]),
        "lastLoggedWeek": last_logged.isoformat() if last_logged else None,
        # The rider is due to Snap when last week (or this one, if already worked) isn't in yet.
        "needsSnap": last_logged is None or last_logged < this_week - timedelta(weeks=1),
        "weeksLogged": len(history),
        "checkinDue": checkin_due(db, user.id),
        "streak": streak(db, user),
    }


@router.post("/transfers/{transfer_id}/confirm")
def confirm(transfer_id: int, body: TransferConfirmIn, user: User = Depends(current_user),
            db: Session = Depends(get_db)) -> dict:
    t = db.scalar(select(Transfer).where(Transfer.id == transfer_id, Transfer.user_id == user.id))
    if t is None:
        raise api_error(404, "not_found", "Tidak dijumpai.", "Not found.")
    confirm_transfer(db, t, body.amount_sen)
    db.commit()
    return {"transfer": transfer_json(t)}


@router.get("/pots")
def list_pots(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    pots = ensure_pots(db, user.id)
    db.commit()
    return {"pots": [pot_json(pots[k]) for k in POT_KINDS]}


@router.patch("/pots/{kind}")
def edit_pot(kind: str, body: PotIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    pots = ensure_pots(db, user.id)
    if kind not in pots:
        raise api_error(404, "not_found", "Tidak dijumpai.", "Not found.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(pots[kind], field, value)
    db.flush()
    if "weekly_sen" in body.model_fields_set:
        recompute(db, user)
    db.commit()
    return {"pot": pot_json(pots[kind])}
