"""Tanya: a small tool loop over the engine, with the number guard on every reply (FR-ADV-1..4, architecture §6.4).

Tools are read-only and scoped to the signed-in rider. The model talks; the engine computes.
"""

import json
from datetime import timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.engine.salary import LeaveIn, Scenario, p_safe_at, risk_word
from app.llm import guard
from app.llm.client import ChatResult, chat
from app.models import Bill, User
from app.services.lessons import lesson
from app.services.pots import ensure_pots
from app.services.salary import run_scenario

PROMPT = (Path(__file__).parent / "prompts" / "tanya.md").read_text()
MAX_TOOL_ROUNDS = 4
RISK = {"ms": {"selamat": "Selamat", "berhati": "Berhati-hati", "berisiko": "Berisiko"},
        "en": {"selamat": "Safe", "berhati": "Careful", "berisiko": "Risky"}}


def _fn(name: str, description: str, properties: dict | None = None) -> dict:
    return {"type": "function", "function": {"name": name, "description": description, "parameters": {
        "type": "object", "properties": properties or {}, "additionalProperties": False}}}


TOOLS = [
    _fn("get_salary", "This week's safe salary, its risk word and safety %, the buffer, and why it changed."),
    _fn("get_forecast", "The rider's usual weekly earnings: a slow week, a usual week and a busy week, and planned "
                        "hours."),
    _fn("simulate", "What-if: the salary and how safe the current salary stays if something changes. Use it for "
                    "'can I afford', new instalments, one-off purchases, more or fewer hours, or leave.", {
        "hours_per_week": {"type": "number", "minimum": 0, "maximum": 84},
        "add_monthly_instalment_rm": {"type": "number", "minimum": 0, "maximum": 100000},
        "one_off_expense_rm": {"type": "number", "minimum": 0, "maximum": 100000},
        "one_off_in_weeks": {"type": "integer", "minimum": 0, "maximum": 11},
        "leave_in_weeks": {"type": "integer", "minimum": 1, "maximum": 11},
        "leave_weeks": {"type": "integer", "minimum": 1, "maximum": 4},
    }),
    _fn("get_pots", "The rider's pots (Penampan, Cuti, Kecemasan, Motor, Raya, i-Saraan) with balances and targets."),
    _fn("get_bills", "The rider's bills with amounts and how often they are due."),
    _fn("explain", "A short lesson using the rider's own numbers.", {
        "topic": {"type": "string", "enum": ["commission", "buffer", "flat_vs_effective", "perkeso", "isaraan",
                                             "leave"]}}),
]


def rm(sen: int) -> float:
    return round(sen / 100, 2)


def run_tool(db: Session, user: User, name: str, args: dict) -> dict:
    """Every tool reads only this rider's data. Results carry money in ringgit (_rm) for the model to quote."""
    if name in ("get_salary", "get_forecast", "simulate"):
        base = run_scenario(db, user, Scenario())
        if base is None:
            return {"error": "no_earnings_logged_yet"}
        inp, now = base
        if name == "get_salary":
            return {"salary_rm": rm(now.salary_sen), "safe_percent": round(now.p_safe * 100),
                    "risk": now.risk, "buffer_rm": rm(inp.buffer_sen), "essentials_rm": rm(inp.essentials_week_sen),
                    "gap_rm": rm(now.jurang["gap_sen"]) if now.jurang else 0}
        if name == "get_forecast":
            return {"slow_week_rm": rm(now.band["low"]), "usual_week_rm": rm(now.band["mid"]),
                    "busy_week_rm": rm(now.band["high"]), "planned_hours": inp.planned_hours}
        leaves = ()
        if args.get("leave_in_weeks"):
            leaves = (LeaveIn(inp.week_start + timedelta(weeks=int(args["leave_in_weeks"])),
                              int(args.get("leave_weeks", 1)), 0),)
        sc = Scenario(hours=args.get("hours_per_week"),
                      add_monthly_sen=round(float(args.get("add_monthly_instalment_rm", 0)) * 100),
                      one_off_sen=round(float(args.get("one_off_expense_rm", 0)) * 100),
                      one_off_week=int(args.get("one_off_in_weeks", 1)), leaves=leaves)
        from app.engine.salary import solve

        new = solve(inp, sc)
        p_now = p_safe_at(inp, now.salary_sen, sc)
        return {"current_salary_rm": rm(now.salary_sen), "current_salary_safe_percent_after": round(p_now * 100),
                "risk": risk_word(p_now), "new_safe_salary_rm": rm(new.salary_sen),
                "salary_change_rm": rm(new.salary_sen - now.salary_sen)}
    if name == "get_pots":
        return {"pots": [{"pot": p.kind, "balance_rm": rm(p.balance_sen), "target_rm": rm(p.target_sen),
                          "weekly_rm": rm(p.weekly_sen)} for p in ensure_pots(db, user.id).values()]}
    if name == "get_bills":
        bills = db.scalars(select(Bill).where(Bill.user_id == user.id, Bill.active))
        return {"bills": [{"name": b.name, "amount_rm": rm(b.amount_sen), "frequency": b.frequency} for b in bills]}
    if name == "explain":
        return lesson(db, user, str(args.get("topic", "buffer")), user.lang)
    return {"error": "unknown_tool"}


def _fallback(results: list[dict], lang: str) -> str:
    """Built only from tool results, so it can't contain a made-up number (FR-ADV-2, last resort)."""
    sim = next((r for r in results if "new_safe_salary_rm" in r), None)
    sal = next((r for r in results if "salary_rm" in r), None)
    if sim:
        word = RISK[lang][sim["risk"]]
        if lang == "ms":
            return (f"{word}. Gaji anda kekal {sim['current_salary_safe_percent_after']}% selamat dengan perubahan "
                    f"ini. Gaji selamat baharu: RM{sim['new_safe_salary_rm']:.0f}.")
        return (f"{word}. Your salary stays {sim['current_salary_safe_percent_after']}% safe with this change. "
                f"New safe salary: RM{sim['new_safe_salary_rm']:.0f}.")
    if sal:
        word = RISK[lang][sal["risk"]]
        if lang == "ms":
            return f"{word}. Gaji anda minggu ini RM{sal['salary_rm']:.0f}, {sal['safe_percent']}% selamat."
        return f"{word}. Your salary this week is RM{sal['salary_rm']:.0f}, {sal['safe_percent']}% safe."
    return ("Maaf, saya tak dapat jawab dengan tepat. Cuba tanya tentang gaji, tabung, bil atau cuti anda."
            if lang == "ms" else "Sorry, I can't answer that precisely. Try asking about your salary, pots, bills "
                                 "or leave.")


def answer(db: Session, user: User, history: list[dict], message: str, on_call) -> dict:
    """Returns {reply, risk, tools, guard_triggered}. on_call(ChatResult) logs usage for every model call."""
    lang = user.lang if user.lang in ("ms", "en") else "ms"
    system = PROMPT.format(lang_name="Bahasa Melayu" if lang == "ms" else "English")
    messages = [{"role": "system", "content": system}, *history,
                {"role": "user", "content": f"<rider_message>{message}</rider_message>"}]
    results: list[dict] = []
    tools_used: list[str] = []

    def complete(msgs: list[dict]) -> ChatResult:
        r = chat("tanya", msgs, tools=TOOLS, max_tokens=500)
        on_call(r)
        return r

    reply = ""
    for _ in range(MAX_TOOL_ROUNDS + 1):
        r = complete(messages)
        calls = getattr(r.message, "tool_calls", None) or []
        if not calls:
            reply = r.message.content or ""
            break
        messages.append({"role": "assistant", "content": r.message.content or "", "tool_calls": [
            {"id": c.id, "type": "function", "function": {"name": c.function.name,
                                                          "arguments": c.function.arguments}} for c in calls]})
        for c in calls:
            try:
                args = json.loads(c.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            out = run_tool(db, user, c.function.name, args if isinstance(args, dict) else {})
            results.append(out)
            tools_used.append(c.function.name)
            messages.append({"role": "tool", "tool_call_id": c.id, "content": json.dumps(out)})

    allowed = guard.allowed_values(message, *(json.dumps(x) for x in results))
    bad = guard.check(reply, allowed)
    triggered = bool(bad)
    if bad:  # one retry, naming the numbers that had no source
        note = (f"Your draft used numbers no tool returned: {', '.join(f'{b:g}' for b in bad)}. Rewrite it using "
                "only numbers from the tool results above, or call a tool.")
        retry = complete([*messages, {"role": "assistant", "content": reply}, {"role": "system", "content": note}])
        reply = retry.message.content or ""
        if not reply or guard.check(reply, allowed) or getattr(retry.message, "tool_calls", None):
            reply = _fallback(results, lang)
    if not reply.strip():
        reply = _fallback(results, lang)
    risk = next((x["risk"] for x in reversed(results) if "risk" in x), None)
    return {"reply": reply.strip(), "risk": risk, "tools": tools_used, "guard_triggered": triggered}
