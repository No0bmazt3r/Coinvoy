"""Renders the Penyata (FR-SLIP-2/3): HTML for the officer view, PDF via fpdf2 (pure Python, so no system libraries).
Both are drawn from the same LABELS and figures, so a loans officer sees exactly what the PDF says. The figures arrive
already computed by the API."""

import base64
from datetime import date
from functools import cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES = Path(__file__).parent / "templates"
# A copy of frontend/public/logo.png, so the backend deploys on its own (`pnpm icons` updates both)
LOGO = Path(__file__).parent / "logo.png"
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


def render_html(name: str, data: dict, lang: str, generated: date, expires: str | None = None) -> str:
    return _env.get_template("penyata.html").render(
        L=LABELS[lang], M=MONTHS[lang], d=data, rm=rm, name=name.split(" ")[0], lang=lang,
        generated=generated.isoformat(), expires=expires, logo=_logo())


def _latin1(value: object) -> str:
    # Simple for now: the built-in PDF font only covers Latin letters, so Chinese or Tamil names print as "?".
    # Add a font file with pdf.add_font() when we need them.
    return str(value).replace("\u2013", "-").encode("latin-1", "replace").decode("latin-1")


def render_pdf(name: str, data: dict, lang: str, generated: date) -> bytes:
    from fpdf import FPDF, FontFace

    L, M, d = LABELS[lang], MONTHS[lang], data
    pdf = FPDF(format="A4")
    pdf.set_margins(16, 18)
    pdf.set_auto_page_break(True, margin=18)
    pdf.add_page()
    pdf.set_text_color(29, 30, 29)
    pdf.set_draw_color(217, 220, 211)

    def text(value: object, size: float = 10, style: str = "", h: float = 5) -> None:
        pdf.set_font("helvetica", style, size)
        pdf.multi_cell(0, h, _latin1(value), new_x="LMARGIN", new_y="NEXT")

    def table(rows: list[list[str]], widths: tuple[int, ...], head: bool) -> None:
        pdf.set_font("helvetica", "", 10)
        align = ("LEFT",) + ("RIGHT",) * (len(widths) - 1)
        heading = FontFace(emphasis="BOLD", color=(91, 94, 87), size_pt=9)
        with pdf.table(col_widths=widths, text_align=align, first_row_as_headings=head,
                       borders_layout="HORIZONTAL_LINES", line_height=7, headings_style=heading) as t:
            for row in rows:
                t.row([_latin1(c) for c in row])

    # Header: logo, title, source
    if LOGO.exists():
        pdf.image(str(LOGO), x=16, y=18, w=12)
    pdf.set_x(31)
    pdf.set_font("helvetica", "B", 18)
    pdf.cell(0, 8, _latin1(L["title"]), new_x="LEFT", new_y="NEXT")
    pdf.set_font("helvetica", "", 9)
    pdf.cell(0, 5, _latin1(f"Coinvoy - {L['source']}: {L[d['source']]}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.set_draw_color(29, 30, 29)
    pdf.line(16, pdf.get_y(), 194, pdf.get_y())
    pdf.set_draw_color(217, 220, 211)
    pdf.ln(4)

    meta = [(L["name"], name.split(" ")[0]), (L["period"], f"{d['from']} - {d['to']}"),
            (L["weeks"], f"{d['weeks']} {L['weeks_logged']}"), (L["generated"], generated.isoformat())]
    table([[k, v] for k, v in meta], (1, 2), head=False)

    pdf.ln(4)
    text(L["summary"], 13, "B", 7)
    src = L[d["source"]]
    table([[L["avg"], rm(d["avg_sen"]), src], [L["min"], rm(d["min_sen"]), src], [L["max"], rm(d["max_sen"]), src],
           [L["trend"], L[d["trend"]], ""], [L["platforms"], ", ".join(d["platforms"]), ""]], (3, 2, 2), head=False)

    pdf.ln(4)
    text(L["month"], 13, "B", 7)
    table([[L["month"], L["weeks"], L["net"], L["avg"], L["hours"], L["source"]]]
          + [[f"{M[m['month'] - 1]} {m['year']}", str(m["weeks"]), rm(m["net_sen"]), rm(m["avg_sen"]), str(m["hours"]),
              L[m["source"]]] for m in d["monthly"]], (3, 2, 3, 3, 2, 3), head=True)

    pdf.ln(4)
    pdf.set_text_color(91, 94, 87)
    text(L["legend"], 9)
    pdf.ln(3)
    pdf.set_text_color(29, 30, 29)
    pdf.set_draw_color(29, 30, 29)
    pdf.set_line_width(0.6)
    pdf.set_font("helvetica", "B", 10)
    pdf.multi_cell(0, 6, _latin1(L["not_credit"]), border=1, padding=3, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.set_text_color(91, 94, 87)
    text(L["disclaimer"], 9)
    return bytes(pdf.output())
