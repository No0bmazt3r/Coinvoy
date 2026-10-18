"""Pots are virtual: the rider has one real savings pocket, and Coinvoy tracks how its money is earmarked.
Balances move only when the rider confirms a transfer ("Dah pindah"), so they reflect money that really moved."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Event, Pot, Transfer, utcnow

POT_KINDS = ("penampan", "cuti", "kecemasan", "motor", "raya", "isaraan", "perkeso")


def ensure_pots(db: Session, user_id: int) -> dict[str, Pot]:
    pots = {p.kind: p for p in db.scalars(select(Pot).where(Pot.user_id == user_id))}
    for kind in POT_KINDS:
        if kind not in pots:
            pots[kind] = Pot(user_id=user_id, kind=kind)
            db.add(pots[kind])
    db.flush()
    return pots


def allocate(allocation: dict[str, int], full_sen: int, confirmed_sen: int) -> dict[str, int]:
    """Split a confirmed amount (same sign as full_sen) across pots.

    Money in fills the earmarked pots first (Cuti for Raya, i-Saraan) and the Penampan gets the rest, so a partial
    transfer protects the plans the rider made. Money out comes out proportionally. Either way the parts add up
    exactly to confirmed_sen.
    """
    if full_sen == 0 or confirmed_sen == 0:
        return {}
    others = {k: v for k, v in allocation.items() if k != "penampan" and v}
    if full_sen > 0:
        left = confirmed_sen
        out: dict[str, int] = {}
        for kind, want in others.items():
            take = min(want, left) if want > 0 else want  # a negative part (Cuti paying out) always applies
            out[kind] = take
            left -= take
        out["penampan"] = left
    else:
        ratio = confirmed_sen / full_sen
        out = {k: round(v * ratio) for k, v in others.items()}
        out["penampan"] = confirmed_sen - sum(out.values())
    return {k: v for k, v in out.items() if v}


def confirm_transfer(db: Session, transfer: Transfer, confirmed_abs_sen: int | None) -> Transfer:
    """confirmed_abs_sen None = the full amount ("Dah pindah"); a number = "Bahagian sahaja" (partial)."""
    full = transfer.amount_sen if transfer.direction == "in" else -transfer.amount_sen
    amount = transfer.amount_sen if confirmed_abs_sen is None else confirmed_abs_sen
    signed = amount if transfer.direction == "in" else -amount
    pots = ensure_pots(db, transfer.user_id)
    if transfer.status in ("confirmed", "partial"):  # re-confirming replaces the earlier amount
        for kind, sen in allocate(transfer.allocation, full, _signed_confirmed(transfer)).items():
            pots[kind].balance_sen -= sen
    for kind, sen in allocate(transfer.allocation, full, signed).items():
        pots[kind].balance_sen += sen
    transfer.confirmed_amount_sen = amount
    transfer.status = "confirmed" if amount >= transfer.amount_sen else "partial"
    transfer.confirmed_at = utcnow()
    db.add(Event(user_id=transfer.user_id, name="transfer_confirmed",
                 props={"amount_sen": amount, "direction": transfer.direction}))
    return transfer


def _signed_confirmed(t: Transfer) -> int:
    amount = t.confirmed_amount_sen or 0
    return amount if t.direction == "in" else -amount
