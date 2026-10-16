"""Sessions, cookies, audit log and the current_user dependency (docs/GOOGLE_AUTH_PORTABLE.md §6)."""

import base64
import hashlib
import secrets
from datetime import timedelta

from fastapi import Depends, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import api_error
from app.models import AuthEvent, AuthSession, User, utcnow

SESSION_COOKIE = "sid"


def random_token() -> str:
    return secrets.token_urlsafe(32)


def sha256_b64url(value: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(value.encode()).digest()).rstrip(b"=").decode()


def _client(request: Request) -> tuple[str | None, str | None]:
    # Behind the Vite proxy or Render, uvicorn's --proxy-headers makes request.client the real client.
    ip = request.client.host if request.client else None
    return ip, (request.headers.get("user-agent") or "")[:500] or None


def session_ttl() -> timedelta:
    return timedelta(days=settings.session_ttl_days)


def log_auth_event(
    db: Session, request: Request, event: str, *, user_id: int | None = None, email: str | None = None,
    reason: str | None = None,
) -> None:
    ip, user_agent = _client(request)
    db.add(AuthEvent(event=event, user_id=user_id, email=email, reason=reason, ip=ip, user_agent=user_agent))


def create_session(db: Session, request: Request, user_id: int) -> str:
    """Returns the raw token; only its hash is stored. Set the cookie after the transaction commits."""
    token = random_token()
    db.execute(delete(AuthSession).where(AuthSession.expires_at < utcnow()))  # cheap housekeeping
    ip, user_agent = _client(request)
    db.add(AuthSession(token_hash=sha256_b64url(token), user_id=user_id, expires_at=utcnow() + session_ttl(),
                       ip=ip, user_agent=user_agent))
    return token


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(SESSION_COOKIE, token, max_age=int(session_ttl().total_seconds()), httponly=True,
                        secure=settings.cookie_secure, samesite="lax", path="/")


def end_session(db: Session, request: Request, response: Response) -> None:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        row = db.execute(
            select(AuthSession, User).join(User, User.id == AuthSession.user_id)
            .where(AuthSession.token_hash == sha256_b64url(token))
        ).first()
        if row:
            session, user = row
            db.delete(session)
            log_auth_event(db, request, "logout", user_id=user.id, email=user.email)
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise api_error(401, "not_signed_in", "Sila log masuk.", "Please sign in.")
    user = db.scalar(
        select(User).join(AuthSession, AuthSession.user_id == User.id)
        .where(AuthSession.token_hash == sha256_b64url(token), AuthSession.expires_at > utcnow())
    )
    if not user:
        raise api_error(401, "session_expired", "Sesi tamat. Sila log masuk semula.",
                        "Session expired. Please sign in again.")
    return user
