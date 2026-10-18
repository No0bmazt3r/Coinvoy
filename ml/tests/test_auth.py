import base64
import json
import time

from sqlalchemy import select

from app.api import auth as auth_api
from app.auth import sha256_b64url
from app.db import SessionLocal
from app.models import AuthEvent, AuthSession, User


def events():
    with SessionLocal() as db:
        return [(e.event, e.reason) for e in db.scalars(select(AuthEvent).order_by(AuthEvent.id))]


def start_google(client):
    """Hit /api/auth/google and return (state, verifier, nonce) from the flow cookie."""
    res = client.get("/api/auth/google", follow_redirects=False)
    assert res.status_code == 302
    assert res.headers["location"].startswith("https://accounts.google.com/")
    return client.cookies.get("google_flow").split(".")


def fake_id_token(**claims):
    body = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    return f"header.{body}.signature"


def good_claims(nonce, /, **override):
    return {"iss": "https://accounts.google.com", "aud": "test-client", "exp": time.time() + 600, "nonce": nonce,
            "sub": "google-123", "email": "faiz@example.com", "email_verified": True, "name": "Faiz Rahman",
            "picture": "https://example.com/a.png"} | override


def test_me_is_401_when_signed_out(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "not_signed_in"


def test_pkce_challenge_is_base64url_sha256_of_verifier():
    # RFC 7636 appendix B test vector
    assert sha256_b64url("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"


def test_start_sends_state_nonce_and_s256_challenge(client):
    res = client.get("/api/auth/google", follow_redirects=False)
    location = res.headers["location"]
    state, verifier, nonce = client.cookies.get("google_flow").split(".")
    assert f"state={state}" in location and f"nonce={nonce}" in location
    assert f"code_challenge={sha256_b64url(verifier)}" in location and "code_challenge_method=S256" in location
    assert "scope=openid+email+profile" in location
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "path=/api/auth/google" in cookie and "max-age=600" in cookie


def test_wrong_state_is_refused_and_audited(client):
    start_google(client)
    res = client.get("/api/auth/google/callback?code=x&state=wrong", follow_redirects=False)
    assert res.headers["location"] == "http://localhost:5173/login?error=state"
    assert events() == [("login_failed", "state")]


def test_cancel_on_google_screen(client):
    start_google(client)
    res = client.get("/api/auth/google/callback?error=access_denied", follow_redirects=False)
    assert res.headers["location"].endswith("/login?error=cancelled")


def test_successful_sign_in_then_second_sign_in_then_logout(client, monkeypatch):
    state, _, nonce = start_google(client)
    monkeypatch.setattr(auth_api, "exchange_code", lambda code, verifier: fake_id_token(**good_claims(nonce)))
    res = client.get(f"/api/auth/google/callback?code=abc&state={state}", follow_redirects=False)
    assert res.headers["location"] == "http://localhost:5173/"

    sid = client.cookies.get("sid")
    with SessionLocal() as db:
        session = db.scalar(select(AuthSession))
        assert session.token_hash == sha256_b64url(sid) != sid  # only the hash is stored
    me = client.get("/api/auth/me").json()["user"]
    assert me["displayName"] == "Faiz Rahman" and me["isDemo"] is False

    # Signing in again: same user, a new login event, no new signup.
    state, _, nonce = start_google(client)
    monkeypatch.setattr(auth_api, "exchange_code", lambda code, verifier: fake_id_token(**good_claims(nonce)))
    client.get(f"/api/auth/google/callback?code=abc&state={state}", follow_redirects=False)
    with SessionLocal() as db:
        assert len(db.scalars(select(User)).all()) == 1
    assert [e for e, _ in events()] == ["signup", "login", "login"]

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert events()[-1] == ("logout", None)


def test_bad_claims_are_refused(client, monkeypatch):
    for bad in ({"nonce": "other"}, {"aud": "someone-else"}, {"email_verified": False}, {"exp": time.time() - 1},
                {"iss": "https://evil.example"}):
        state, _, nonce = start_google(client)
        token = fake_id_token(**good_claims(nonce, **bad))
        monkeypatch.setattr(auth_api, "exchange_code", lambda code, verifier, t=token: t)
        res = client.get(f"/api/auth/google/callback?code=abc&state={state}", follow_redirects=False)
        assert res.headers["location"].endswith("/login?error=token"), bad
    with SessionLocal() as db:
        assert db.scalars(select(User)).all() == []


def test_demo_login_gives_each_tap_its_own_user(client):
    assert client.post("/api/auth/demo").status_code == 204
    first = client.get("/api/auth/me").json()["user"]
    assert first["isDemo"] is True
    client.cookies.clear()
    client.post("/api/auth/demo")
    assert client.get("/api/auth/me").json()["user"]["id"] != first["id"]


def test_foreign_origin_post_is_refused(client):
    res = client.post("/api/auth/demo", headers={"Origin": "https://evil.example"})
    assert res.status_code == 403
    assert client.post("/api/auth/demo", headers={"Origin": "http://localhost:5173"}).status_code == 204
