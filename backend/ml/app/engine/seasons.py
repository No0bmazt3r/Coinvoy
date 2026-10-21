"""Malaysian calendar features (ADR-6): Ramadan, public holidays and school holidays, per ISO week.

The forecast works in "season-free" log-rates: each logged week is divided by its season multiplier before fitting,
and each future week is multiplied by its own. The effect sizes live in priors.json (season_log_effect) and are team
estimates until scripts/train_rate_model.py fits them from consented histories.
"""

import json
from datetime import date, timedelta
from functools import cache
from pathlib import Path

import numpy as np

DATA = Path(__file__).parent / "data"
CALENDAR_FILE = DATA / "calendar_my.json"
FEATURES = ("ramadan", "public_holiday", "school_holiday")


@cache
def _effects() -> dict[str, float]:
    return json.loads((DATA / "priors.json").read_text()).get("season_log_effect", {})


@cache
def _calendar() -> tuple[frozenset[date], tuple[tuple[date, date], ...], tuple[tuple[date, date], ...]]:
    data = json.loads(CALENDAR_FILE.read_text())
    spans = lambda key: tuple((date.fromisoformat(a), date.fromisoformat(b)) for a, b in data[key])  # noqa: E731
    return frozenset(map(date.fromisoformat, data["public_holidays"])), spans("ramadan"), spans("school_holidays")


def features(monday: date) -> dict[str, float]:
    """Share of the week's 7 days that fall in Ramadan / are public holidays / are school holidays."""
    holidays, ramadan, school = _calendar()
    days = [monday + timedelta(days=i) for i in range(7)]
    share = lambda spans: sum(any(a <= d <= b for a, b in spans) for d in days) / 7  # noqa: E731
    return {"ramadan": share(ramadan), "public_holiday": sum(d in holidays for d in days) / 7,
            "school_holiday": share(school)}


def log_effect(monday: date | None) -> float:
    """log of the week's season multiplier; 0 for an unknown week."""
    if monday is None:
        return 0.0
    return float(sum(_effects().get(k, 0.0) * v for k, v in features(monday).items()))


def multipliers(mondays: list[date]) -> np.ndarray:
    return np.exp([log_effect(m) for m in mondays])
