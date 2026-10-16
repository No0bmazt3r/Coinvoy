from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, ForeignKey
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
