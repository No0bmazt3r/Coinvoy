"""BM cost entry (FR-SNAP-6): type "minyak 40", see the parsed chip, save. Each parse records its tier."""

from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.config import settings
from app.db import get_db
from app.engine.calendar import today_kl, week_start
from app.errors import api_error
from app.llm.client import chat
from app.llm.usage import check_quota, log_usage
from app.models import Event, Expense, User
from app.nlp.bm_parser import parse
from app.nlp.lexicon import CATEGORIES
from app.schemas import MAX_SEN, Camel

router = APIRouter(prefix="/api/expenses", tags=["expenses"])
PROMPT = (Path(__file__).resolve().parents[1] / "llm" / "prompts" / "bm.md").read_text()
Category = Literal["minyak", "servis", "ansuran", "makan", "telefon", "parking", "tol", "sewa", "keluarga",
                   "motor_tahunan", "lain"]


class ParseIn(Camel):
    text: str = Field(min_length=1, max_length=120)


class LlmCost(BaseModel):
    category: Category
    amount_rm: float | None = Field(None, ge=0, le=100_000)


class ExpenseIn(Camel):
    week_start: date | None = None
    amount_sen: int = Field(gt=0, le=MAX_SEN)
    category: Category
    note: str | None = Field(None, max_length=120)
    input: Literal["text", "voice", "form"] = "text"
    parse_tier: Literal["rules", "classifier", "llm", "manual"] | None = None


def expense_json(x: Expense) -> dict:
    return {"id": x.id, "weekStart": x.week_start.isoformat(), "amountSen": x.amount_sen, "category": x.category,
            "note": x.note, "input": x.input, "parseTier": x.parse_tier}


@router.post("/parse")
def parse_cost(body: ParseIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    def llm(text: str) -> tuple[int | None, str]:
        check_quota(db, user.id, "bm")
        result = chat("bm", [{"role": "system", "content": PROMPT},
                             {"role": "user", "content": f"<note>{text}</note>"}], schema=LlmCost, max_tokens=200)
        log_usage(db, user.id, "bm", result)
        out: LlmCost = result.parsed  # type: ignore[assignment]
        return (round(out.amount_rm * 100) if out.amount_rm is not None else None), out.category

    use_llm = settings.llm_configured
    try:
        p = parse(body.text, settings.bm_classifier_threshold, llm if use_llm else None)
    except Exception:  # noqa: BLE001 - the LLM is a bonus tier; fall back to what tiers 1–2 found
        p = parse(body.text, settings.bm_classifier_threshold, None)
    db.commit()
    return {"amountSen": p.amount_sen, "category": p.category if p.category in CATEGORIES else None,
            "tier": p.tier, "confidence": p.confidence}


@router.post("", status_code=201)
def add_expense(body: ExpenseIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    wk = week_start(body.week_start or today_kl())
    if wk > week_start(today_kl()):
        raise api_error(422, "bad_week", "Minggu tidak sah.", "That week isn't valid.")
    x = Expense(user_id=user.id, week_start=wk, amount_sen=body.amount_sen, category=body.category, note=body.note,
                input=body.input, parse_tier=body.parse_tier)
    db.add(x)
    db.add(Event(user_id=user.id, name="expense_added", props={"tier": body.parse_tier, "input": body.input}))
    db.commit()
    return {"expense": expense_json(x)}


@router.get("")
def list_expenses(week: date | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    q = select(Expense).where(Expense.user_id == user.id)
    if week:
        q = q.where(Expense.week_start == week_start(week))
    return {"expenses": [expense_json(x) for x in db.scalars(q.order_by(Expense.id.desc()).limit(200))]}


@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    x = db.scalar(select(Expense).where(Expense.id == expense_id, Expense.user_id == user.id))
    if x is None:
        raise api_error(404, "not_found", "Tidak dijumpai.", "Not found.")
    db.delete(x)
    db.commit()
