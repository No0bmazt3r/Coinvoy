"""Google sign-in built directly on OpenID Connect (authorization code + PKCE), plus the judges' demo login.

Ported from docs/GOOGLE_AUTH_PORTABLE.md; every rule in its §2 is kept.
"""

import base64
import json
import logging
import time
from datetime import timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import (
    create_session,
    current_user,
    end_session,
    log_auth_event,
    random_token,
    set_session_cookie,
    sha256_b64url,
)
from app.config import settings
from app.db import get_db
from app.errors import api_error
from app.models import User, utcnow

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"  # noqa: S105 (a URL, not a password)
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

FLOW_COOKIE = "google_flow"
FLOW_PATH = "/api/auth/google"
FLOW_MAX_AGE = 10 * 60
DEMO_TTL = timedelta(hours=24)


def redirect_uri() -> str:
    return f"{settings.app_url}/api/auth/google/callback"


def fail(db: Session, request: Request, reason: str, email: str | None = None) -> RedirectResponse:
    """Every failed sign-in is recorded, then the browser goes back to the login page with a reason."""
    log_auth_event(db, request, "login_failed", reason=reason, email=email)
    db.commit()
    response = RedirectResponse(f"{settings.app_url}/login?error={reason}", status_code=302)
    response.delete_cookie(FLOW_COOKIE, path=FLOW_PATH)
    return response


def exchange_code(code: str, verifier: str) -> str:
    """Server-to-server code exchange; the client secret never reaches the browser. Returns the ID token."""
    res = httpx.post(GOOGLE_TOKEN_URL, timeout=10, data={
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": redirect_uri(),
        "grant_type": "authorization_code",
        "code_verifier": verifier,
    })
    res.raise_for_status()
    return res.json()["id_token"]


def decode_claims(id_token: str) -> dict:
    # No signature check *only* because the token came straight from Google's token endpoint over TLS
    # (OIDC Core §3.1.3.7). If we ever accept an ID token from the browser, verify it against Google's JWKS.
    payload = id_token.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))


def claims_valid(claims: dict, nonce: str) -> bool:
    return (
        claims.get("iss") in GOOGLE_ISSUERS
        and claims.get("aud") == settings.google_client_id
        and claims.get("exp", 0) > time.time()
        and bool(nonce) and claims.get("nonce") == nonce
        and claims.get("email_verified") is True
    )


@router.get("/google")
def google_start(request: Request, db: Session = Depends(get_db)) -> RedirectResponse:
    """1. Send the browser to Google with a fresh state (CSRF), PKCE verifier and nonce (replay)."""
    if not settings.google_configured:
        return fail(db, request, "not_configured")
    state, verifier, nonce = random_token(), random_token(), random_token()
    query = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": sha256_b64url(verifier),
        "code_challenge_method": "S256",
        "prompt": "select_account",
    })
    response = RedirectResponse(f"{GOOGLE_AUTH_URL}?{query}", status_code=302)
    response.set_cookie(FLOW_COOKIE, f"{state}.{verifier}.{nonce}", max_age=FLOW_MAX_AGE, path=FLOW_PATH,
                        httponly=True, secure=settings.cookie_secure, samesite="lax")
    return response


@router.get("/google/callback")
def google_callback(request: Request, db: Session = Depends(get_db)) -> RedirectResponse:
    """2. Google sends the browser back here with a one-time code."""
    parts = (request.cookies.get(FLOW_COOKIE) or "").split(".")
    state, verifier, nonce = parts if len(parts) == 3 else ("", "", "")
    params = request.query_params

    if params.get("error"):
        return fail(db, request, "cancelled")
    if not params.get("code") or not state or params.get("state") != state:
        return fail(db, request, "state")

    # 3. Exchange the code for tokens, server to server.
    try:
        claims = decode_claims(exchange_code(params["code"], verifier))
    except (httpx.HTTPError, KeyError, ValueError, IndexError):
        log.exception("google token exchange failed")
        return fail(db, request, "exchange")

    # 4. Check the ID token's claims.
    if not claims_valid(claims, nonce):
        return fail(db, request, "token", claims.get("email"))

    # 5. Find or create the user (keyed on `sub`, never email), start a session and record it in one transaction.
    user = db.scalar(select(User).where(User.google_sub == claims["sub"]))
    is_new = user is None
    if user is None:
        user = User(google_sub=claims["sub"])
        db.add(user)
    user.email = claims["email"]
    user.display_name = claims.get("name") or claims["email"].split("@")[0]
    user.avatar_url = claims.get("picture")
    user.last_login_at = utcnow()
    db.flush()
    token = create_session(db, request, user.id)
    if is_new:
        log_auth_event(db, request, "signup", user_id=user.id, email=user.email)
    log_auth_event(db, request, "login", user_id=user.id, email=user.email)
    db.commit()

    # The cookie is set only after the commit.
    response = RedirectResponse(f"{settings.app_url}/", status_code=302)
    response.delete_cookie(FLOW_COOKIE, path=FLOW_PATH)
    set_session_cookie(response, token)
    return response


@router.post("/demo", status_code=204)
def demo_login(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    """A fresh temporary demo user per tap, so each judge has their own copy (FR-AUTH-3)."""
    if not settings.demo_enabled:
        raise api_error(404, "demo_disabled", "Demo tidak tersedia.", "The demo isn't available.")
    # ponytail: expired demo users are cleaned up here instead of by a scheduler; add a job if demo traffic grows.
    db.execute(delete(User).where(User.is_demo, User.created_at < utcnow() - DEMO_TTL))
    user = User(email="demo@coinvoy.invalid", display_name="Faiz", is_demo=True, last_login_at=utcnow())
    db.add(user)
    db.flush()
    token = create_session(db, request, user.id)
    log_auth_event(db, request, "signup", user_id=user.id, email=user.email)
    log_auth_event(db, request, "login", user_id=user.id, email=user.email)
    db.commit()
    set_session_cookie(response, token)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    end_session(db, request, response)


@router.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    return {"user": {
        "id": str(user.id),
        "email": user.email,
        "displayName": user.display_name,
        "avatarUrl": user.avatar_url,
        "isDemo": user.is_demo,
    }}
