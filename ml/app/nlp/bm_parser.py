"""BM cost phrases → amount + category, in three tiers (FR-SNAP-6, FR-SNAP-12, architecture §6.6):

1. rules: amounts (digits, "rm40", "1.5k", BM number words) and a category lexicon
2. our own classifier (TF-IDF + logistic regression) when the lexicon has no hit
3. the LLM, only when the classifier isn't confident or there's no amount

The amount always comes from the rules when they find one; the LLM never overrides a parsed number.
"""

import re
from dataclasses import dataclass

from app.nlp.lexicon import CENTS, PHRASES, UNITS, WHOLE, WORDS

_DIGITS = re.compile(r"(\d+(?:[.,]\d+)?)(?:\s*(k)\b)?")  # "1.5k" = 1500; "40 kopi" is not 40k


@dataclass
class Parse:
    amount_sen: int | None
    category: str | None
    tier: str  # rules | classifier | llm | none
    confidence: float = 1.0


def tokens(text: str) -> list[str]:
    t = text.lower().replace("rm", " rm ")
    t = re.sub(r"(\d)([a-z])", r"\1 \2", t)  # "40ringgit" → "40 ringgit", but keeps "1.5k" as "1.5 k"
    return re.findall(r"[a-z0-9]+(?:[.,][0-9]+)?", t)


def words_to_number(words: list[str]) -> int | None:
    """"dua ratus lima puluh" → 250, "seribu dua ratus" → 1200, "dua belas" → 12. None if no number words."""
    total = chunk = last = 0
    seen = False
    for w in words:
        if w in UNITS:
            last, seen = UNITS[w], True
        elif w in WHOLE:  # "seribu" closes the thousands; "seratus", "sepuluh", "sebelas" add to the chunk
            if WHOLE[w] == 1000:
                total, chunk, last = total + 1000, 0, 0
            else:
                chunk += WHOLE[w]
            seen = True
        elif w == "puluh":
            chunk, last, seen = chunk + (last or 1) * 10, 0, True
        elif w == "belas":
            chunk, last, seen = chunk + 10 + last, 0, True
        elif w == "ratus":
            chunk, last, seen = chunk + (last or 1) * 100, 0, True
        elif w == "ribu":
            total, chunk, last, seen = total + ((chunk + last) or 1) * 1000, 0, 0, True
        else:
            return None
    return total + chunk + last if seen else None


def parse_amount(text: str) -> int | None:
    """Sen, or None. Digits win over words; "lima puluh sen" adds cents."""
    low = text.lower()
    m = _DIGITS.search(low.replace("rm", " "))
    if m:
        raw, k = m.group(1), m.group(2)
        if "," in raw:  # "1,200" is thousands; "12,50" is a decimal comma
            whole, frac = raw.split(",")
            raw = whole + frac if len(frac) == 3 else f"{whole}.{frac}"
        value = float(raw) * (1000 if k else 1)
        return round(value * 100)

    toks = tokens(low)
    ringgit = cents = None
    run: list[str] = []
    for tok in toks + ["<end>"]:
        is_num = tok in UNITS or tok in WHOLE or tok in ("puluh", "belas", "ratus", "ribu")
        if is_num:
            run.append(tok)
            continue
        if run:
            n = words_to_number(run)
            if tok in CENTS and n is not None and n < 100:
                cents = n
            elif ringgit is None and n is not None:
                ringgit = n
            run = []
    if ringgit is None and cents is None:
        return None
    return (ringgit or 0) * 100 + (cents or 0)


def lexicon_category(text: str) -> str | None:
    low = " ".join(tokens(text))
    for phrase in sorted(PHRASES, key=len, reverse=True):
        if re.search(rf"\b{re.escape(phrase)}\b", low):
            return PHRASES[phrase]
    for tok in tokens(text):
        if tok in WORDS:
            return WORDS[tok]
    return None


def rules(text: str) -> Parse:
    amount, category = parse_amount(text), lexicon_category(text)
    return Parse(amount, category, "rules" if amount is not None and category else "none")



# Below this the classifier's guess goes to the LLM.
def parse(text: str, threshold: float, llm=None) -> Parse:
    """The full pipeline. llm(text) -> (amount_sen | None, category) is only called when tiers 1–2 can't decide."""
    from app.nlp import classifier

    r = rules(text)
    if r.tier == "rules":
        return r
    guess = None if r.category else classifier.predict(text)
    if r.category is None and guess and guess[1] >= threshold:
        return Parse(r.amount_sen, guess[0], "classifier", round(guess[1], 3))
    if llm is not None and (r.category is None or r.amount_sen is None):
        amount, category = llm(text)
        # A number the rules found always wins; the LLM only fills what's missing.
        return Parse(r.amount_sen if r.amount_sen is not None else amount, r.category or category, "llm", 0.0)
    category = r.category or (guess[0] if guess else None)
    return Parse(r.amount_sen, category, "classifier" if guess and not r.category else "rules",
                 round(guess[1], 3) if guess and not r.category else 1.0)
