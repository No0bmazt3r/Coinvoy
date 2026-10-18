"""The number guard (FR-ADV-2, ADR-7): every number in a Tanya reply must come from a tool result or the rider's own
message. This is Coinvoy's main AI-safety claim, so it is plain code, not a prompt.

Numbers are compared as values: "RM1,234.50", "1.2k", "52 peratus" and BM number words ("empat puluh") all normalise.
A reply may round a tool value to the precision it writes (RM617.40 → "RM617"). Small counts followed by a unit word
("3 pilihan", "2 minggu") are structural, not financial, and are allowed.
"""

import re

from app.nlp.bm_parser import words_to_number
from app.nlp.lexicon import UNITS, WHOLE

COUNT_UNITS = {"minggu", "hari", "pilihan", "langkah", "bulan", "jam", "kali", "week", "weeks", "day", "days",
               "option", "options", "step", "steps", "month", "months", "hour", "hours", "times", "tahun", "year",
               "years"}
NUMBER_WORDS = set(UNITS) | set(WHOLE) | {"puluh", "belas", "ratus", "ribu"}
_NUM = re.compile(r"(?<![\w.])(?:rm\s?)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(k\b|%|peratus|percent)?", re.I)


def extract(text: str) -> list[tuple[float, int, str]]:
    """(value, decimals written, the text after it) for every number in text, digits and BM words alike."""
    found = []
    for m in _NUM.finditer(text):
        whole, frac, suffix = m.group(1).replace(",", ""), m.group(2) or "", (m.group(3) or "").lower()
        value = float(f"{whole}.{frac}") if frac else float(whole)
        decimals = len(frac)
        if suffix == "k":
            value, decimals = value * 1000, 0
        found.append((value, decimals, text[m.end():m.end() + 12].lower()))
    words = re.findall(r"[a-z]+", text.lower())
    run: list[str] = []
    for i, w in enumerate(words + ["."]):
        if w in NUMBER_WORDS:
            run.append(w)
        elif run:
            n = words_to_number(run)
            if n is not None:
                found.append((float(n), 0, " ".join(words[i:i + 2])))
            run = []
    return found


def allowed_values(*texts: str) -> set[float]:
    return {v for t in texts for v, _, _ in extract(t)}


def matches(value: float, decimals: int, allowed: set[float]) -> bool:
    # The reply may round a tool value to the precision it shows (RM617.40 → RM617, 95.3% → 95%).
    tol = 0.5 * 10 ** -decimals + 1e-9
    return any(abs(value - a) <= tol for a in allowed) or any(
        abs(value - a * 100) <= tol for a in allowed if 0 < a <= 1)  # p_safe 0.953 written as 95%


def check(reply: str, allowed: set[float]) -> list[float]:
    """The numbers in reply that nothing supports. Empty list = the reply passes."""
    bad = []
    for value, decimals, after in extract(reply):
        if value <= 12 and value == int(value) and after.split(" ")[0].strip(".,)") in COUNT_UNITS:
            continue  # "3 pilihan", "2 minggu": a count, not money
        if not matches(value, decimals, allowed):
            bad.append(value)
    return bad
