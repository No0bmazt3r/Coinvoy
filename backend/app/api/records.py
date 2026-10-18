"""Rekod: payslips, the Penyata PDF and officer links (FR-SLIP-1..5)."""

import secrets
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse, Response
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user, sha256_b64url
from app.db import get_db
from app.errors import api_error
from app.models import Event, OfficerLink, User, utcnow
from app.schemas import Camel
from app.services import penyata

router = APIRouter(tags=["records"])
LINK_DAYS = 7


class LinkIn(Camel):
    months: Literal[3, 6] = 3
    days: int = Field(LINK_DAYS, ge=1, le=30)


def _locked(db: Session, user: User) -> None:
    n = penyata.weeks_logged(db, user.id)
    if n < penyata.UNLOCK_WEEKS:
        raise api_error(403, "penyata_locked", f"Penyata dibuka selepas 12 minggu data ({n}/12).",
                        f"The statement unlocks with 12 weeks of data ({n}/12).")


def link_json(link: OfficerLink) -> dict:
    return {"id": link.id, "months": link.months, "expiresAt": link.expires_at.isoformat() + "Z",
            "revoked": link.revoked_at is not None, "openedCount": link.opened_count,
            "createdAt": link.created_at.isoformat() + "Z"}


@router.get("/api/payslip/{week}")
def get_payslip(week: date, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return penyata.payslip(db, user, week)


@router.get("/api/penyata")
def penyata_status(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    n = penyata.weeks_logged(db, user.id)
    unlocked = n >= penyata.UNLOCK_WEEKS
    return {"weeksLogged": n, "unlockAt": penyata.UNLOCK_WEEKS, "unlocked": unlocked,
            "summary": penyata.statement(db, user, 3) if unlocked else None}


@router.get("/api/penyata.pdf")
def penyata_pdf(months: int = Query(3), lang: Literal["ms", "en"] = Query("ms"),
                user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    if months not in (3, 6):
        raise api_error(422, "bad_months", "Pilih 3 atau 6 bulan.", "Choose 3 or 6 months.")
    _locked(db, user)
    pdf = penyata.render_pdf(user, penyata.statement(db, user, months), lang)
    db.add(Event(user_id=user.id, name="penyata_generated", props={"months": months}))
    db.commit()
    return Response(pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="coinvoy-penyata-{months}bulan.pdf"',
        "Cache-Control": "no-store"})


@router.post("/api/officer-links", status_code=201)
def create_link(body: LinkIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """A read-only Surat Pendapatan link: random 128-bit token, stored hashed, expiring, revocable."""
    _locked(db, user)
    token = secrets.token_urlsafe(16)
    link = OfficerLink(user_id=user.id, token_hash=sha256_b64url(token), months=body.months,
                       expires_at=utcnow() + timedelta(days=body.days))
    db.add(link)
    db.commit()
    return {"link": link_json(link), "path": f"/o/{token}"}  # the raw token is shown once, never stored


@router.get("/api/officer-links")
def list_links(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    links = db.scalars(select(OfficerLink).where(OfficerLink.user_id == user.id).order_by(OfficerLink.id.desc()))
    return {"links": [link_json(link) for link in links]}


@router.delete("/api/officer-links/{link_id}", status_code=204)
def revoke_link(link_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    link = db.scalar(select(OfficerLink).where(OfficerLink.id == link_id, OfficerLink.user_id == user.id))
    if link is None:
        raise api_error(404, "not_found", "Tidak dijumpai.", "Not found.")
    link.revoked_at = link.revoked_at or utcnow()
    db.commit()


GONE = """<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Coinvoy</title>
<body style="font:16px system-ui;padding:32px;max-width:480px;margin:auto">
<h1>Pautan tidak lagi sah</h1><p>Penunggang telah membatalkan pautan ini, atau ia sudah tamat tempoh.</p>
<h1>This link is no longer valid</h1><p>The rider revoked it, or it has expired.</p></body>"""


@router.get("/o/{token}", response_class=HTMLResponse, include_in_schema=False)
def officer_view(token: str, lang: Literal["ms", "en"] = "ms", db: Session = Depends(get_db)) -> HTMLResponse:
    """Public, read-only, no login. Shows only the Penyata (FR-SLIP-4)."""
    link = db.scalar(select(OfficerLink).where(OfficerLink.token_hash == sha256_b64url(token)))
    headers = {"X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}
    if link is None:
        raise api_error(404, "not_found", "Tidak dijumpai.", "Not found.")
    if link.revoked_at or link.expires_at < utcnow():
        return HTMLResponse(GONE, status_code=410, headers=headers)
    user = db.get(User, link.user_id)
    link.opened_count += 1
    db.add(Event(user_id=user.id, name="officer_link_opened", props={"link_id": link.id}))
    db.commit()
    html = penyata.render_html(user, penyata.statement(db, user, link.months), lang,
                               expires=link.expires_at.date().isoformat())
    return HTMLResponse(html, headers=headers)
