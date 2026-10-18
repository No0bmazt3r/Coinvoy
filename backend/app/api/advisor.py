"""Penasihat: Jurang now; Tanya, Semak Layak, lender check and Celik join this router (FR-ADV-*)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import current_user
from app.config import settings
from app.db import get_db
from app.engine.salary import Scenario, solve
from app.models import Event, User
from app.services.salary import run_scenario

router = APIRouter(prefix="/api", tags=["advisor"])
MAX_HOURS = 84
FATIGUE_HOURS = 60


@router.get("/jurang")
def jurang(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """When the safe salary is below essentials: the gap, and three ways to close it, every number simulated."""
    run = run_scenario(db, user, Scenario())
    if run is None or run[1].jurang is None:
        return {"active": False}
    inp, res = run
    essentials = inp.essentials_week_sen

    # Hours: the fewest whole hours whose safe salary covers essentials, capped at 84 a week.
    lo, hi = int(inp.planned_hours), MAX_HOURS
    reach = solve(inp, Scenario(hours=hi)).salary_sen >= essentials
    while lo < hi:
        mid = (lo + hi) // 2
        lo, hi = (lo, mid) if solve(inp, Scenario(hours=mid)).salary_sen >= essentials else (mid + 1, hi)
    hours = hi
    at_hours = solve(inp, Scenario(hours=hours)).salary_sen

    db.add(Event(user_id=user.id, name="jurang_shown", props={"gap_sen": res.jurang["gap_sen"]}))
    db.commit()
    return {
        "active": True,
        "essentialsSen": essentials,
        "salarySen": res.salary_sen,
        "gapSen": res.jurang["gap_sen"],
        "hours": {
            "plannedHours": inp.planned_hours,
            "hours": hours,
            "extraHours": hours - inp.planned_hours,
            "salarySen": at_hours,
            "closesGap": reach,
            "fatigue": hours > FATIGUE_HOURS,
        },
        "costs": {"cutSen": res.jurang["gap_sen"], "essentialsAfterSen": res.salary_sen},
        "entitlements": {
            "isaraanMatchRate": settings.isaraan_match_rate,
            "isaraanMatchCapSen": settings.isaraan_match_cap_sen,
            "perkesoDeductedAtSource": settings.perkeso_deducted_at_source,
        },
    }
