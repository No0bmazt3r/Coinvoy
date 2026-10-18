from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    # ponytail: naive UTC everywhere, because SQLite has no timezone type. Use timestamptz if we go Postgres-only.
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    google_sub: Mapped[str | None] = mapped_column(unique=True)  # Google's stable id; null for demo users
    email: Mapped[str]
    display_name: Mapped[str]
    avatar_url: Mapped[str | None]
    is_demo: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    last_login_at: Mapped[datetime | None]
    # Profile (FR-ONB-1..4). Null until onboarding asks for it.
    lang: Mapped[str] = mapped_column(default="ms")
    theme: Mapped[str] = mapped_column(default="system")  # system | light | dark
    city: Mapped[str | None]
    payday_weekday: Mapped[int | None]  # 0 = Monday
    default_hours: Mapped[int | None]  # planned hours online per week
    essentials_week_sen: Mapped[int | None]  # rough weekly basic costs
    pocket_ready: Mapped[bool] = mapped_column(default=False)  # "Sudah ada pocket" (FR-ONB-6)
    sick_days_covered: Mapped[int] = mapped_column(default=3)  # a year (FR-CUTI-3)
    accent: Mapped[str] = mapped_column(default="lime")  # cosmetic, unlocked by streak level (FR-STRK-4)
    onboarded_at: Mapped[datetime | None]


class AuthSession(Base):
    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(primary_key=True)  # sha256 of the cookie; the raw token is never stored
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    ip: Mapped[str | None]
    user_agent: Mapped[str | None]


class AuthEvent(Base):
    """Insert-only audit trail. user_id becomes NULL if the user is deleted, so history survives."""

    __tablename__ = "auth_events"
    __table_args__ = (CheckConstraint("event IN ('signup', 'login', 'login_failed', 'logout')", name="event_kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    event: Mapped[str]
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    email: Mapped[str | None]
    reason: Mapped[str | None]  # login_failed only: cancelled | state | exchange | token | not_configured
    ip: Mapped[str | None]
    user_agent: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)


def _owner() -> Mapped[int]:
    return mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)


class Consent(Base):
    """One row per decision, so the history of what the rider agreed to (and when) is kept (FR-ONB-2)."""

    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    kind: Mapped[str]  # privacy | llm_processing | indeks_rider
    version: Mapped[str]
    granted: Mapped[bool]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class UserPlatform(Base):
    __tablename__ = "user_platforms"
    __table_args__ = (UniqueConstraint("user_id", "platform"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    platform: Mapped[str]  # grab | foodpanda | shopeefood | lalamove | other


class Earning(Base):
    """One platform's figures for one ISO week. net = gross - commission + incentives + tips."""

    __tablename__ = "earnings"
    __table_args__ = (UniqueConstraint("user_id", "week_start", "platform"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    week_start: Mapped[date] = mapped_column(index=True)  # a Monday, Asia/Kuala_Lumpur
    platform: Mapped[str]
    gross_sen: Mapped[int]
    commission_sen: Mapped[int] = mapped_column(default=0)
    incentives_sen: Mapped[int] = mapped_column(default=0)
    tips_sen: Mapped[int] = mapped_column(default=0)  # incl. cash orders (FR-SNAP-8)
    trips: Mapped[int | None]
    hours_online: Mapped[float | None]
    source: Mapped[str] = mapped_column(default="manual")  # snap | manual | history
    verification: Mapped[str] = mapped_column(default="self")  # self | checked | verified
    extraction_confidence: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    @property
    def net_sen(self) -> int:
        return self.gross_sen - self.commission_sen + self.incentives_sen + self.tips_sen


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    week_start: Mapped[date] = mapped_column(index=True)
    amount_sen: Mapped[int]
    category: Mapped[str]
    note: Mapped[str | None]
    input: Mapped[str] = mapped_column(default="text")  # text | voice | form
    parse_tier: Mapped[str | None]  # rules | classifier | llm | manual
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    name: Mapped[str]
    amount_sen: Mapped[int]
    frequency: Mapped[str]  # weekly | monthly | yearly | once
    due_day: Mapped[int | None]  # weekly: 0-6 (Mon-Sun); monthly: 1-31
    due_date: Mapped[date | None]  # yearly (month/day used) | once
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Pot(Base):
    """A virtual allocation inside the rider's one real savings pocket; balance moves only on confirmed transfers."""

    __tablename__ = "pots"
    __table_args__ = (UniqueConstraint("user_id", "kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    kind: Mapped[str]  # penampan | cuti | kecemasan | motor | raya | isaraan
    target_sen: Mapped[int] = mapped_column(default=0)
    balance_sen: Mapped[int] = mapped_column(default=0)
    weekly_sen: Mapped[int] = mapped_column(default=0)  # set aside every week; the engine counts it as an outflow


class SalaryRun(Base):
    __tablename__ = "salary_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    week_start: Mapped[date] = mapped_column(index=True)
    salary_sen: Mapped[int]
    p_safe: Mapped[float]
    risk: Mapped[str]  # selamat | berhati | berisiko
    buffer_start_sen: Mapped[int]
    result: Mapped[dict[str, Any]] = mapped_column(JSON)  # band, factors, build-up, jurang, scenario inputs
    model_version: Mapped[str]
    seed: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Transfer(Base):
    """One instruction a week: move money into the pocket (in) or take it out (out). Confirmed by the rider."""

    __tablename__ = "transfers"
    __table_args__ = (UniqueConstraint("user_id", "week_start"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    week_start: Mapped[date]
    direction: Mapped[str]  # in | out
    amount_sen: Mapped[int]
    allocation: Mapped[dict[str, int]] = mapped_column(JSON)  # pot kind -> sen, for the full amount
    status: Mapped[str] = mapped_column(default="pending")  # pending | confirmed | partial | skipped
    confirmed_amount_sen: Mapped[int | None]
    confirmed_at: Mapped[datetime | None]
    verification: Mapped[str] = mapped_column(default="self")  # self | checked (statement cross-check)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class LeavePlan(Base):
    __tablename__ = "leave_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    kind: Mapped[str]  # planned | sick
    label: Mapped[str | None]  # e.g. "Cuti Raya"
    start_week: Mapped[date]
    weeks: Mapped[int]
    days: Mapped[int | None]  # sick only: days off that week (1-6)
    set_aside_week_sen: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(default="planned")  # planned | active | done | cancelled
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Contribution(Base):
    """Money the rider paid into a scheme (i-Saraan Plus) and the government match it earned (FR-CAR-2/3)."""

    __tablename__ = "contributions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    kind: Mapped[str]  # isaraan
    amount_sen: Mapped[int]
    match_sen: Mapped[int]
    year: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Checkin(Base):
    __tablename__ = "checkins"
    __table_args__ = (UniqueConstraint("user_id", "week_start"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    week_start: Mapped[date]
    answer: Mapped[str]  # ya | hampir | tak_cukup
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class StreakFreeze(Base):
    """Manual freezes only (2 a quarter, FR-STRK-6). Leave and sick weeks freeze automatically from leave_plans."""

    __tablename__ = "streak_freezes"
    __table_args__ = (UniqueConstraint("user_id", "week_start"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    week_start: Mapped[date]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Badge(Base):
    __tablename__ = "badges"
    __table_args__ = (UniqueConstraint("user_id", "kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    kind: Mapped[str]  # penampan_penuh | cuti_pertama | isaraan_dituntut | ...
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class TanyaMessage(Base):
    __tablename__ = "tanya_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    role: Mapped[str]  # user | assistant
    content: Mapped[str]
    tools: Mapped[list[Any] | None] = mapped_column(JSON)
    guard_triggered: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)  # 90-day retention


class OfficerLink(Base):
    __tablename__ = "officer_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _owner()
    token_hash: Mapped[str] = mapped_column(unique=True)
    months: Mapped[int]
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]
    opened_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class LlmUsage(Base):
    __tablename__ = "llm_usage"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    route: Mapped[str]
    model: Mapped[str]
    input_tokens: Mapped[int]
    output_tokens: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)


class Event(Base):
    """Impact analytics in our own DB (PRD §9). No third-party trackers."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(index=True)
    props: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class IndexContribution(Base):
    """Indeks Rider (FR-IDX-1): only written with consent, and deliberately carries no user_id."""

    __tablename__ = "index_contributions"

    id: Mapped[int] = mapped_column(primary_key=True)
    city: Mapped[str]
    platform: Mapped[str]
    month: Mapped[str]  # YYYY-MM
    rate_sen_per_hour: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
