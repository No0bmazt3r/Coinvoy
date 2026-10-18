import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.api import advisor, auth, benefits, expenses, home, profile, records, snap, weeks
from app.config import settings

log = logging.getLogger("coinvoy")

app = FastAPI(title="Coinvoy API", docs_url="/api/docs", openapi_url="/api/openapi.json")
for module in (auth, profile, weeks, home, snap, advisor, benefits, records, expenses):
    app.include_router(module.router)

if not settings.google_configured:
    log.warning("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set: Google sign-in is off, the demo login still works.")

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@app.middleware("http")
async def check_origin(request: Request, call_next):
    # CSRF defence on top of SameSite=Lax: browsers send Origin on unsafe requests, so a foreign one is refused.
    origin = request.headers.get("origin")
    if request.method in UNSAFE_METHODS and origin and origin != settings.app_url.rstrip("/"):
        return JSONResponse(status_code=403, content={"error": {
            "code": "bad_origin", "message_ms": "Permintaan ditolak.", "message_en": "Request refused."}})
    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message_ms": str(exc.detail),
                                                              "message_en": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": detail}, headers=exc.headers)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/meta")
def meta() -> dict:
    """Public facts the privacy page shows: who processes screenshots and chat, and where."""
    return {"llmEnabled": settings.llm_configured, "llmProvider": settings.llm_provider_name or None,
            "llmRegion": settings.llm_region_note or None, "noticeVersion": "2026-10"}
