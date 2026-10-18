"""Celik: 30-second lessons triggered by the rider's own data (FR-ADV-8), also Tanya's explain tool.

Every number in a lesson is computed here from the rider's data or config, so Tanya can quote it through the guard.
"""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.engine.calendar import today_kl, week_start
from app.models import Earning, LeavePlan, User
from app.services.pots import ensure_pots

TOPICS = ("commission", "buffer", "flat_vs_effective", "perkeso", "isaraan", "leave")


def _facts(db: Session, user: User) -> dict:
    since = week_start(today_kl()) - timedelta(weeks=4)
    recent = list(db.scalars(select(Earning).where(Earning.user_id == user.id, Earning.week_start >= since)))
    gross = sum(e.gross_sen for e in recent)
    commission = sum(e.commission_sen for e in recent)
    pots = ensure_pots(db, user.id)
    target = 2 * (user.essentials_week_sen or 0)
    leave = db.scalar(select(LeavePlan.id).where(LeavePlan.user_id == user.id, LeavePlan.kind == "planned",
                                                 LeavePlan.status != "cancelled",
                                                 LeavePlan.start_week >= week_start(today_kl())))
    return {"commission_pct": round(commission / gross * 100) if gross else None,
            "buffer_rm": round(pots["penampan"].balance_sen / 100), "target_rm": round(target / 100),
            "isaraan_weekly_rm": round(pots["isaraan"].weekly_sen / 100),
            "isaraan_rate_pct": round(settings.isaraan_match_rate * 100),
            "isaraan_cap_rm": round(settings.isaraan_match_cap_sen / 100),
            "perkeso_deducted": settings.perkeso_deducted_at_source, "leave_planned": leave is not None}


TEXT = {
    "commission": {
        "ms": ("Komisen platform", "Bulan ini platform ambil {commission_pct}% daripada pendapatan kasar anda. "
               "Bandingkan antara platform: kadar bersih sejam lebih penting daripada jumlah order."),
        "en": ("Platform commission", "This month the platforms took {commission_pct}% of your gross earnings. "
               "Compare platforms by net pay per hour, not number of orders.")},
    "buffer": {
        "ms": ("Kenapa penampan?", "Penampan anda RM{buffer_rm}, sasaran RM{target_rm} (2 minggu kos asas). "
               "Bila penampan penuh, minggu perlahan tak lagi bermakna gaji jatuh."),
        "en": ("Why a buffer?", "Your buffer is RM{buffer_rm}, the target is RM{target_rm} (2 weeks of basic costs). "
               "Once it's full, a slow week no longer means a pay cut.")},
    "flat_vs_effective": {
        "ms": ("Kadar rata vs kadar sebenar", "Kadar rata dikira atas jumlah asal sepanjang tempoh, walaupun hutang "
               "makin kecil. Jadi kadar sebenar hampir dua kali ganda. Semak Layak tunjukkan kedua-duanya."),
        "en": ("Flat vs real rate", "A flat rate charges interest on the full amount for the whole term, even as "
               "the debt shrinks, so the real rate is close to double. Semak Layak shows both.")},
    "perkeso": {
        "ms": ("PERKESO anda", "Caruman PERKESO (SKSPS) melindungi anda jika cedera semasa bekerja. "
               "{perkeso_line}"),
        "en": ("Your PERKESO", "PERKESO (SKSPS) covers you if you're hurt while working. {perkeso_line}")},
    "isaraan": {
        "ms": ("Duit percuma kerajaan", "i-Saraan Plus: kerajaan tambah {isaraan_rate_pct}% caruman KWSP anda, "
               "sehingga RM{isaraan_cap_rm} setahun. Sekarang anda asingkan RM{isaraan_weekly_rm} seminggu."),
        "en": ("Free government money", "i-Saraan Plus: the government adds {isaraan_rate_pct}% to your EPF "
               "contributions, up to RM{isaraan_cap_rm} a year. You set aside RM{isaraan_weekly_rm} a week now.")},
    "leave": {
        "ms": ("Cuti berbayar", "Rancang cuti awal: asingkan sedikit setiap minggu, dan minggu cuti tetap bergaji, "
               "dibayar oleh minggu-minggu baik anda."),
        "en": ("Paid leave", "Plan leave early: set a little aside each week, and your week off still pays, "
               "paid for by your good weeks.")},
}
PERKESO_LINE = {"ms": ("Platform anda sudah memotongnya.", "Daftar SKSPS di laman PERKESO."),
                "en": ("Your platform already deducts it.", "Register for SKSPS on the PERKESO site.")}


def lesson(db: Session, user: User, topic: str, lang: str) -> dict:
    lang = lang if lang in ("ms", "en") else "ms"
    topic = topic if topic in TOPICS else "buffer"
    f = _facts(db, user)
    title, body = TEXT[topic][lang]
    f["perkeso_line"] = PERKESO_LINE[lang][0 if f["perkeso_deducted"] else 1]
    return {"topic": topic, "title": title, "text": body.format(**{k: ("?" if v is None else v) for k, v in f.items()})}


def triggered(db: Session, user: User, lang: str) -> list[dict]:
    """The lessons this rider's data calls for right now (at least one always applies)."""
    f = _facts(db, user)
    topics = []
    if f["commission_pct"] is not None and f["commission_pct"] > 20:
        topics.append("commission")
    if f["target_rm"] and f["buffer_rm"] < f["target_rm"]:
        topics.append("buffer")
    if f["isaraan_weekly_rm"] == 0:
        topics.append("isaraan")
    if not f["leave_planned"]:
        topics.append("leave")
    topics.append("perkeso")
    return [lesson(db, user, t, lang) for t in topics]
