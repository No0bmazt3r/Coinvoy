"""Every LLM call is logged (llm_usage) and capped per rider per day (architecture §6.7, NFR-8)."""

from datetime import datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.engine.calendar import today_kl
from app.errors import api_error
from app.llm.client import ChatResult, Route
from app.models import LlmUsage


def check_quota(db: Session, user_id: int, route: Route, calls: int = 1) -> None:
    limit = getattr(settings, f"llm_daily_{route}")
    # Days and months are Malaysian (UTC+8); created_at is naive UTC.
    midnight_kl_utc = datetime.combine(today_kl(), time()) - timedelta(hours=8)
    month_start_utc = datetime.combine(today_kl().replace(day=1), time()) - timedelta(hours=8)
    used = db.scalar(select(func.count()).select_from(LlmUsage).where(
        LlmUsage.user_id == user_id, LlmUsage.route == route, LlmUsage.created_at >= midnight_kl_utc)) or 0
    total = db.scalar(select(func.count()).select_from(LlmUsage).where(LlmUsage.created_at >= month_start_utc)) or 0
    if used + calls > limit:
        raise api_error(429, "llm_quota", "Had harian AI dicapai. Sila isi secara manual atau cuba esok.",
                        "Daily AI limit reached. Please enter it manually or try tomorrow.")
    if total + calls > settings.llm_monthly_call_cap:
        raise api_error(429, "llm_budget", "Ciri AI berehat bulan ini. Sila isi secara manual.",
                        "AI features are paused this month. Please enter it manually.")


def log_usage(db: Session, user_id: int | None, route: Route, result: ChatResult) -> None:
    db.add(LlmUsage(user_id=user_id, route=route, model=result.model, input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens))
