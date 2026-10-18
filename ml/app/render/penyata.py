"""Renders the Penyata (FR-SLIP-2/3): HTML for the officer view, PDF via WeasyPrint. Same template for both, so a
loans officer sees exactly what the PDF says. The figures arrive already computed by the API."""

import base64
from datetime import date
from functools import cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES = Path(__file__).parent / "templates"
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
                         "sendiri.", "expires": "Pautan tamat", "weeks_logged": "minggu direkod"},
    "en": {"title": "Income Statement", "period": "Period", "generated": "Generated", "name": "Name",
           "month": "Month", "weeks": "Weeks", "net": "Net earnings", "avg": "Weekly average",
           "hours": "Hours online", "summary": "Summary", "min": "Lowest week", "max": "Highest week",
           "trend": "Trend", "up": "Rising", "down": "Falling", "flat": "Steady", "platforms": "Platforms",
           "source": "Source", "self": "Self-reported", "checked": "Cross-checked", "verified": "Verified",
           "legend": "Self-reported: from the rider's screenshots or entries. Cross-checked: matched against a bank "
                     "or e-wallet statement. Verified: data directly from the platform.",
           "not_credit": "This is not a credit score. Coinvoy does not lend and does not assess eligibility.",
           "disclaimer": "Figures are based on data the rider shared. Lenders make their own decisions.",
           "expires": "Link expires", "weeks_logged": "weeks logged"},
}
MONTHS = {"ms": ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"],
          "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}


def rm(sen: int) -> str:
    return f"RM{sen / 100:,.2f}"


@cache
def _logo() -> str:
    return "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode() if LOGO.exists() else ""


def render_html(name: str, data: dict, lang: str, generated: date, expires: str | None = None,
                for_pdf: bool = False) -> str:
    return _env.get_template("penyata.html").render(
        L=LABELS[lang], M=MONTHS[lang], d=data, rm=rm, name=name.split(" ")[0], lang=lang,
        generated=generated.isoformat(), expires=expires, logo=_logo(), for_pdf=for_pdf)


def render_pdf(name: str, data: dict, lang: str, generated: date) -> bytes:
    from weasyprint import HTML  # heavy import, only when a PDF is asked for

    return HTML(string=render_html(name, data, lang, generated, for_pdf=True)).write_pdf()
