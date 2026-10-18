"""ISO weeks in Asia/Kuala_Lumpur (NFR-11) and when bills fall due."""

import calendar as _cal
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

KL = ZoneInfo("Asia/Kuala_Lumpur")


def today_kl() -> date:
    return datetime.now(KL).date()


def week_start(d: date) -> date:
    """The Monday of d's ISO week."""
    return d - timedelta(days=d.weekday())


def weeks_between(a: date, b: date) -> int:
    """Whole weeks from week a to week b (both Mondays)."""
    return (b - a).days // 7


def bill_due_in_week(frequency: str, due_day: int | None, due_date: date | None, monday: date) -> bool:
    days = [monday + timedelta(days=i) for i in range(7)]
    if frequency == "weekly":
        return True
    if frequency == "monthly":
        # A due day past the month's end (e.g. the 31st in February) falls on its last day.
        return any(d.day == min(due_day or 1, _cal.monthrange(d.year, d.month)[1]) for d in days)
    if frequency == "yearly" and due_date:
        return any((d.month, d.day) == (due_date.month, due_date.day) for d in days)
    if frequency == "once" and due_date:
        return monday <= due_date <= days[-1]
    return False
