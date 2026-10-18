"""Slip Gaji and Penyata (FR-SLIP-*): an honest income statement where every figure says where it came from.

The PDF and the public officer view render the same template, so a loans officer sees exactly what the PDF says.
"""

import base64
from collections import defaultdict
from datetime import date, timedelta
from functools import cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.engine.calendar import today_kl, week_start
from app.models import Earning, Expense, SalaryRun, Transfer, User

UNLOCK_WEEKS = 12  # FR-SLIP-5; uploaded history counts
TEMPLATES = Path(__file__).resolve().parents[1] / "templates"
LOGO = Path(__file__).resolve().parents[3] / "frontend" / "public" / "logo.png"
_env = Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(["html"]))

LABELS = {
    "ms": {"title": "Penyata Pendapatan", "period": "Tempoh", "generated": "Dijana", "name": "Nama",
           "month": "Bulan", "weeks": "Minggu", "net": "Pendapatan bersih", "avg": "Purata seminggu",
           "hours": "Jam online", "summary": "Ringkasan", "min": "Minggu terendah", "max": "Minggu tertinggi",
           "trend": "Arah aliran", "up": "Meningkat", "down": "Menurun", "flat": "Stabil", "platforms": "Platform",
           "source": "Sumber", "self": "Dilapor sendiri", "checked": "Disemak silang", "verified": "Disahkan",
           "legend": "Dilapor sendiri: daripada gambar skrin atau catatan penunggang. Disemak silang: dipadankan "
                     "dengan penyata bank atau e-dompet. Disahkan: data terus daripada platform.",
           "not_credit": "Ini bukan skor kredit. Coinvoy tidak memberi pinjaman dan tidak menilai kelayakan.",
           "disclaimer": "Angka berdasarkan data yang dikongsi oleh penunggang. Pemberi pinjaman membuat keputusan "
                         "sendiri.", "expires": "Pautan tamat", "of": "daripada", "weeks_logged": "minggu direkod"},
    "en": {"title": "Income Statement", "period": "Period", "generated": "Generated", "name": "Name",
           "month": "Month", "weeks": "Weeks", "net": "Net earnings", "avg": "Weekly average",
           "hours": "Hours online", "summary": "Summary", "min": "Lowest week", "max": "Highest week",
           "trend": "Trend", "up": "Rising", "down": "Falling", "flat": "Steady", "platforms": "Platforms",
           "source": "Source", "self": "Self-reported", "checked": "Cross-checked", "verified": "Verified",
           "legend": "Self-reported: from the rider's screenshots or entries. Cross-checked: matched against a bank "
                     "or e-wallet statement. Verified: data directly from the platform.",
           "not_credit": "This is not a credit score. Coinvoy does not lend and does not assess eligibility.",
           "disclaimer": "Figures are based on data the rider shared. Lenders make their own decisions.",
           "expires": "Link expires", "of": "of", "weeks_logged": "weeks logged"},
}
MONTHS = {"ms": ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"],
          "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
RANK = {"self": 0, "checked": 1, "verified": 2}


def rm(sen: int) -> str:
    return f"RM{sen / 100:,.2f}"


def weeks_logged(db: Session, user_id: int) -> int:
    return len(set(db.scalars(select(Earning.week_start).where(Earning.user_id == user_id))))


def statement(db: Session, user: User, months: int) -> dict:
    """The figures, each with the weakest source label among the weeks behind it (FR-SLIP-3)."""
    end = week_start(today_kl())
    start = end - timedelta(weeks=round(months * 52 / 12))
    rows = list(db.scalars(select(Earning).where(Earning.user_id == user.id, Earning.week_start >= start,
                                                 Earning.week_start < end)))
    weeks: dict[date, list[Earning]] = defaultdict(list)
    for e in rows:
        weeks[e.week_start].append(e)
    weekly = sorted((wk, sum(e.net_sen for e in es), min((e.verification for e in es), key=RANK.__getitem__),
                     sum(e.hours_online or 0 for e in es)) for wk, es in weeks.items())
    by_month: dict[tuple[int, int], list] = defaultdict(list)
    for w in weekly:
        by_month[(w[0].year, w[0].month)].append(w)
    nets = [w[1] for w in weekly]
    half = len(nets) // 2
    trend = "flat"
    if half >= 2:
        a, b = sum(nets[:half]) / half, sum(nets[half:]) / (len(nets) - half)
        trend = "up" if b > a * 1.05 else "down" if b < a * 0.95 else "flat"
    weakest = lambda ws: min((w[2] for w in ws), key=RANK.__getitem__, default="self")  # noqa: E731
    return {
        "from": start, "to": end - timedelta(days=1), "weeks": len(weekly), "months": months,
        "monthly": [{"year": y, "month": m, "weeks": len(ws), "net_sen": sum(w[1] for w in ws),
                     "avg_sen": sum(w[1] for w in ws) // len(ws), "hours": round(sum(w[3] for w in ws)),
                     "source": weakest(ws)} for (y, m), ws in sorted(by_month.items())],
        "avg_sen": sum(nets) // len(nets) if nets else 0,
        "min_sen": min(nets, default=0), "max_sen": max(nets, default=0), "trend": trend,
        "platforms": sorted({e.platform for e in rows}), "source": weakest(weekly),
    }


def render_html(user: User, data: dict, lang: str, expires: str | None = None, for_pdf: bool = False) -> str:
    return _env.get_template("penyata.html").render(
        L=LABELS[lang], M=MONTHS[lang], d=data, rm=rm, name=user.display_name.split(" ")[0], lang=lang,
        generated=today_kl().isoformat(), expires=expires, logo=_logo_data_uri(), for_pdf=for_pdf)


@cache
def _logo_data_uri() -> str:
    return "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode() if LOGO.exists() else ""


def render_pdf(user: User, data: dict, lang: str) -> bytes:
    from weasyprint import HTML  # heavy import, only when a PDF is asked for

    return HTML(string=render_html(user, data, lang, for_pdf=True)).write_pdf()


def payslip(db: Session, user: User, week: date) -> dict:
    """A weekly payslip (FR-SLIP-1): what came in for week, and what happened on the payday after it."""
    payday = week + timedelta(weeks=1)
    earnings = list(db.scalars(select(Earning).where(Earning.user_id == user.id, Earning.week_start == week)))
    costs = defaultdict(int)
    for x in db.scalars(select(Expense).where(Expense.user_id == user.id, Expense.week_start == week)):
        costs[x.category] += x.amount_sen
    run = db.scalar(select(SalaryRun).where(SalaryRun.user_id == user.id, SalaryRun.week_start == payday))
    transfer = db.scalar(select(Transfer).where(Transfer.user_id == user.id, Transfer.week_start == payday))
    gross = sum(e.gross_sen for e in earnings)
    return {
        "weekStart": week.isoformat(),
        "platforms": [{"platform": e.platform, "grossSen": e.gross_sen, "commissionSen": e.commission_sen,
                       "incentivesSen": e.incentives_sen, "tipsSen": e.tips_sen, "netSen": e.net_sen,
                       "hoursOnline": e.hours_online, "trips": e.trips, "verification": e.verification}
                      for e in earnings],
        "netSen": sum(e.net_sen for e in earnings),
        "costs": dict(costs),
        "salarySen": run.salary_sen if run else None,
        "perkeso": {"deductedAtSource": settings.perkeso_deducted_at_source,
                    "estimateSen": round(gross * settings.perkeso_rate)},
        "transfer": {"direction": transfer.direction, "amountSen": transfer.amount_sen, "status": transfer.status,
                     "allocation": transfer.allocation} if transfer else None,
    }
