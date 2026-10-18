"""Profile, onboarding answers and consent records (FR-ONB-1..4, FR-ONB-6)."""

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.errors import api_error
from app.models import Consent, User, UserPlatform, utcnow
from app.schemas import ConsentIn, ProfileIn
from app.services.benefits import streak
from app.services.salary import platforms_of, recompute

router = APIRouter(prefix="/api", tags=["profile"])

# Changing these changes the salary, so the engine re-runs.
ENGINE_FIELDS = {"city", "default_hours", "essentials_week_sen", "platforms", "sick_days_covered"}


def user_json(db: Session, user: User) -> dict:
    consents = {c.kind: c for c in db.scalars(
        select(Consent).where(Consent.user_id == user.id).order_by(Consent.created_at))}  # latest wins
    return {
        "id": str(user.id),
        "email": user.email,
        "displayName": user.display_name,
        "avatarUrl": user.avatar_url,
        "isDemo": user.is_demo,
        "lang": user.lang,
        "theme": user.theme,
        "city": user.city,
        "paydayWeekday": user.payday_weekday,
        "defaultHours": user.default_hours,
        "essentialsWeekSen": user.essentials_week_sen,
        "pocketReady": user.pocket_ready,
        "sickDaysCovered": user.sick_days_covered,
        "accent": user.accent,
        "platforms": platforms_of(db, user.id),
        "onboarded": user.onboarded_at is not None,
        "consents": {k: {"granted": c.granted, "version": c.version} for k, c in consents.items()},
    }


@router.patch("/me")
def update_me(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    changes = body.model_dump(exclude_unset=True)
    platforms = changes.pop("platforms", None)
    onboarded = changes.pop("onboarded", None)
    if "accent" in changes and changes["accent"] not in streak(db, user)["accents"]:
        raise api_error(422, "accent_locked", "Warna ini belum dibuka.", "This colour isn't unlocked yet.")
    for field, value in changes.items():
        setattr(user, field, value)
    if platforms is not None:
        db.execute(delete(UserPlatform).where(UserPlatform.user_id == user.id))
        db.add_all(UserPlatform(user_id=user.id, platform=p) for p in dict.fromkeys(platforms))
    if onboarded and user.onboarded_at is None:
        user.onboarded_at = utcnow()
    db.flush()
    if ENGINE_FIELDS & body.model_fields_set:
        recompute(db, user)
    db.commit()
    return {"user": user_json(db, user)}


@router.post("/consents", status_code=201)
def record_consent(body: ConsentIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    db.add(Consent(user_id=user.id, kind=body.kind, version=body.version, granted=body.granted))
    db.commit()
    return {"user": user_json(db, user)}
