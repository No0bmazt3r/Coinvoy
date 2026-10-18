"""Request bodies. JSON is camelCase on the wire (like /auth/me), snake_case in Python."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

Platform = Literal["grab", "foodpanda", "shopeefood", "lalamove", "other"]
MAX_SEN = 10_000_000  # RM100,000: architecture §8.2 bounds


def camel(value):
    """Engine results are stored snake_case; the API speaks camelCase all the way down."""
    if isinstance(value, dict):
        return {to_camel(k): camel(v) for k, v in value.items()}
    if isinstance(value, list):
        return [camel(v) for v in value]
    return value


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class ProfileIn(Camel):
    lang: Literal["ms", "en"] | None = None
    theme: Literal["system", "light", "dark"] | None = None
    display_name: str | None = Field(None, min_length=1, max_length=60)
    city: str | None = Field(None, max_length=60)
    payday_weekday: int | None = Field(None, ge=0, le=6)
    default_hours: int | None = Field(None, ge=0, le=84)
    essentials_week_sen: int | None = Field(None, ge=0, le=MAX_SEN)
    pocket_ready: bool | None = None
    sick_days_covered: int | None = Field(None, ge=0, le=14)
    accent: Literal["lime", "aqua", "amber", "pink", "sky"] | None = None
    platforms: list[Platform] | None = Field(None, max_length=5)
    onboarded: bool | None = None


class ConsentIn(Camel):
    kind: Literal["privacy", "llm_processing", "indeks_rider"]
    version: str = Field(max_length=20)
    granted: bool


class BillBody(Camel):
    name: str = Field(min_length=1, max_length=60)
    amount_sen: int = Field(gt=0, le=MAX_SEN)
    frequency: Literal["weekly", "monthly", "yearly", "once"]
    due_day: int | None = Field(None, ge=0, le=31)
    due_date: date | None = None
    active: bool = True

    @model_validator(mode="after")
    def _due(self) -> "BillBody":
        if self.frequency == "weekly" and self.due_day is not None and self.due_day > 6:
            raise ValueError("weekly due_day is a weekday, 0-6")
        if self.frequency == "monthly" and not self.due_day:
            raise ValueError("monthly bills need due_day 1-31")
        if self.frequency in ("yearly", "once") and self.due_date is None:
            raise ValueError("yearly and one-off bills need due_date")
        return self


class EarningIn(Camel):
    platform: Platform
    gross_sen: int = Field(ge=0, le=MAX_SEN)
    commission_sen: int = Field(0, ge=0, le=MAX_SEN)
    incentives_sen: int = Field(0, ge=0, le=MAX_SEN)
    tips_sen: int = Field(0, ge=0, le=MAX_SEN)
    trips: int | None = Field(None, ge=0, le=2000)
    hours_online: float | None = Field(None, ge=0, le=168)
    source: Literal["snap", "manual", "history"] = "manual"
    extraction_confidence: Literal["high", "medium", "low"] | None = None


class WeekIn(Camel):
    week_start: date
    platforms: list[EarningIn] = Field(min_length=1, max_length=5)


class WeeksIn(Camel):
    weeks: list[WeekIn] = Field(min_length=1, max_length=26)  # history upload confirms many at once


class TransferConfirmIn(Camel):
    amount_sen: int | None = Field(None, ge=0, le=MAX_SEN)  # None = the full amount


class PotIn(Camel):
    target_sen: int | None = Field(None, ge=0, le=MAX_SEN)
    weekly_sen: int | None = Field(None, ge=0, le=MAX_SEN)


class LeaveBody(Camel):
    label: str | None = Field(None, max_length=40)
    start_week: date
    weeks: int = Field(ge=1, le=4)


class SickIn(Camel):
    days: int = Field(ge=1, le=6)


class ContributionIn(Camel):
    amount_sen: int = Field(gt=0, le=MAX_SEN)


class CheckinIn(Camel):
    week_start: date
    answer: Literal["ya", "hampir", "tak_cukup"]


class FreezeIn(Camel):
    week_start: date
