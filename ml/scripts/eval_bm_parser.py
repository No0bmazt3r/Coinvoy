"""Accuracy of the BM cost parser on REAL held-out rider phrases (decisions.md E4, FR-SNAP-12).

    uv run --directory ml python -m scripts.eval_bm_parser

Reports category accuracy for rules only, rules + our classifier, and the share of phrases that would still need the
LLM. The LLM tier lives in the API; run its own check there. Exits 1 below --min (the CI gate) once the test set exists.
"""

import argparse
import csv
from pathlib import Path

from app.nlp.bm_parser import lexicon_category, parse

TEST = Path(__file__).resolve().parents[1] / "data" / "bm_phrases_test.csv"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.7)
    ap.add_argument("--min", type=float, default=0.9)
    args = ap.parse_args()
    rows = [r for r in csv.DictReader(TEST.open()) if r.get("text")] if TEST.exists() else []
    if not rows:
        print(f"No real test phrases yet in {TEST}. Collect ≥150 from rider interviews (decisions.md E4).")
        return
    gold = [r["category"] for r in rows]
    rules = [lexicon_category(r["text"]) for r in rows]
    full = [parse(r["text"], args.threshold) for r in rows]
    acc = lambda pred: sum(p == g for p, g in zip(pred, gold, strict=True)) / len(gold)  # noqa: E731
    pipeline = acc([p.category for p in full])
    needs_llm = sum(p.tier != "rules" and p.confidence < args.threshold for p in full) / len(full)
    print(f"phrases                     {len(rows)}")
    print(f"rules only                  {acc(rules):.1%}")
    print(f"rules + classifier          {pipeline:.1%}")
    print(f"would still need the LLM    {needs_llm:.1%}")
    if pipeline < args.min:
        raise SystemExit(f"below the {args.min:.0%} gate")


if __name__ == "__main__":
    main()
