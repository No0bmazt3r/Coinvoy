"""Snap: an earnings screenshot → draft weeks for the rider to confirm (FR-SNAP-1, -4, -7, -11).

The image is re-encoded in memory (which also strips EXIF), sent once, and dropped. Nothing is written anywhere.
The model has no tools, and its answer must fit the schema, so text inside an image can't make it do anything.
"""

import hashlib
import io
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from app.config import settings
from app.engine.calendar import today_kl, week_start
from app.errors import api_error
from app.llm.client import ChatResult, chat, image_part

PROMPT_FILE = Path(__file__).parent / "prompts" / "snap.md"
PROMPT_VERSION = hashlib.sha256(PROMPT_FILE.read_bytes()).hexdigest()[:8]
CACHE_DIR = Path(__file__).parent / "cache"
MAX_BYTES = 5 * 1024 * 1024
MAX_EDGE = 1568
FORMATS = {"JPEG", "PNG", "WEBP"}
WEEKLY_GROSS_SANE_RM = 10_000  # above this a weekly figure is a misread, not a rider's week


class SnapWeek(BaseModel):
    platform: Literal["grab", "foodpanda", "shopeefood", "lalamove", "other"] | None = None
    week_start: date | None = None
    week_end: date | None = None
    gross_rm: float | None = Field(None, ge=0)
    commission_rm: float | None = Field(None, ge=0)
    incentives_rm: float | None = Field(None, ge=0)
    tips_rm: float | None = Field(None, ge=0)
    trips: int | None = Field(None, ge=0)
    hours_online: float | None = Field(None, ge=0)
    confidence: Literal["high", "medium", "low"] = "low"
    notes: str | None = None


class SnapOut(BaseModel):
    is_earnings_screen: bool
    weeks: list[SnapWeek] = Field(default_factory=list, max_length=12)


def clean_image(raw: bytes) -> bytes:
    """Refuse anything that isn't a real JPEG/PNG/WebP, shrink it, and re-encode it (drops EXIF and metadata)."""
    if len(raw) > MAX_BYTES:
        raise api_error(413, "image_too_big", "Gambar terlalu besar (had 5 MB).", "Image too large (5 MB max).")
    try:
        img = Image.open(io.BytesIO(raw))
        if img.format not in FORMATS:
            raise UnidentifiedImageError
        img.load()
    except (UnidentifiedImageError, OSError) as e:
        raise api_error(415, "not_an_image", "Fail ini bukan gambar. Guna JPG atau PNG.",
                        "That file isn't an image. Use JPG or PNG.") from e
    img = img.convert("RGB")
    img.thumbnail((MAX_EDGE, MAX_EDGE))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=85)
    return out.getvalue()


def extract(image: bytes, platforms: list[str]) -> tuple[SnapOut, ChatResult | None]:
    """Returns the model's answer and the call (None when replayed from the demo cache)."""
    key = hashlib.sha256(image + PROMPT_VERSION.encode()).hexdigest()
    cached = CACHE_DIR / f"{key}.json"
    if settings.demo_llm_cache and cached.exists():
        return SnapOut.model_validate_json(cached.read_text()), None
    system = PROMPT_FILE.read_text().format(year=today_kl().year, platforms=", ".join(platforms) or "unknown")
    result = chat("snap", [
        {"role": "system", "content": system},
        {"role": "user", "content": [{"type": "text", "text": "Read this earnings screenshot."}, image_part(image)]},
    ], schema=SnapOut, max_tokens=1200)
    out: SnapOut = result.parsed  # type: ignore[assignment]
    if settings.demo_llm_cache:
        CACHE_DIR.mkdir(exist_ok=True)
        cached.write_text(out.model_dump_json())
    return out, result


def to_sen(rm: float | None) -> int:
    return round((rm or 0) * 100)


def drafts(out: SnapOut, default_platform: str) -> list[dict]:
    """Model answer → draft rows in sen, with the week snapped to its Monday and consistency warnings (FR-SNAP-7)."""
    last_week = week_start(today_kl()) - timedelta(weeks=1)
    rows = []
    for w in out.weeks:
        if w.gross_rm is None:
            continue  # no total visible: nothing to draft, the rider can type it
        monday = week_start(w.week_start or w.week_end or last_week)
        warnings = []
        if w.gross_rm > WEEKLY_GROSS_SANE_RM:
            warnings.append("gross_high")
        if w.hours_online is not None and w.hours_online > 100:
            warnings.append("hours_high")
        if w.trips and w.hours_online and w.trips > w.hours_online * 6:
            warnings.append("trips_vs_hours")
        if w.trips and w.gross_rm and not 2 <= w.gross_rm / w.trips <= 60:
            warnings.append("fare_odd")
        if monday > week_start(today_kl()):
            monday, warnings = last_week, [*warnings, "date_future"]
        rows.append({
            "weekStart": monday.isoformat(),
            "platform": w.platform or default_platform,
            "grossSen": to_sen(w.gross_rm),
            "commissionSen": to_sen(w.commission_rm),
            "incentivesSen": to_sen(w.incentives_rm),
            "tipsSen": to_sen(w.tips_rm),
            "trips": w.trips,
            "hoursOnline": w.hours_online,
            "confidence": w.confidence,
            "warnings": warnings,
            "injectionSuspected": bool(w.notes and "instruction" in w.notes.lower()),
        })
    return rows

