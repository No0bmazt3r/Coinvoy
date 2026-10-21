"""Trains the pooled rate model (ADR-6) on rider histories and compares it with the shrinkage forecast.

    uv run --directory ml python -m scripts.train_rate_model ../private_data/histories.csv   # real, consented
    uv run --directory ml python -m scripts.train_rate_model --synthetic 60                  # dry run, labelled

Same CSV as scripts/backtest.py. Riders are split 80/20 by rider, so the held-out score is on people the model never
saw. Writes app/engine/artifacts/rate_model.joblib and rate_model_card.md. The engine only uses the model when
RATE_MODEL=gbm, which should be set only if `scripts.backtest --rate-model gbm` beats the default on real histories.
"""

import argparse
from datetime import date
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

from app.engine.forecast import SHRINK_K, WeekObs, prior_for, season_free_logs
from app.engine.rate_model import ARTIFACT, MIN_WEEKS, row
from scripts.backtest import load, synthetic


def examples(weeks: list, log_prior: float, hours_default: float) -> tuple[list, list, list]:
    """One example per week after the first MIN_WEEKS: features from the weeks before, the week's log-rate."""
    logs = season_free_logs([WeekObs(n, h, d) for d, n, h in weeks], hours_default)
    xs, ys, shrink = [], [], []
    for t in range(MIN_WEEKS, len(logs)):
        past = logs[:t]
        xs.append(row(past, log_prior))
        ys.append(logs[t] - log_prior)
        w = t / (t + SHRINK_K)
        shrink.append(w * past.mean() + (1 - w) * log_prior - log_prior)
    return xs, ys, shrink


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", nargs="?", type=Path)
    ap.add_argument("--synthetic", type=int, default=0)
    args = ap.parse_args()
    if not args.csv and not args.synthetic:
        ap.error("give a histories CSV, or --synthetic N for a dry run")
    riders = synthetic(args.synthetic) if args.synthetic else load(args.csv)
    label = "SYNTHETIC" if args.synthetic else "real"
    log_prior = float(np.log(prior_for(["other"], None).rate_sen_per_hour))

    ids = sorted(riders)
    rng = np.random.default_rng(7)
    test_ids = set(rng.choice(ids, max(1, len(ids) // 5), replace=False))
    split = {"train": ([], [], []), "test": ([], [], [])}
    for rid in ids:
        x, y, s = examples(riders[rid], log_prior, 45.0)
        for acc, part in zip(split["test" if rid in test_ids else "train"], (x, y, s), strict=True):
            acc.extend(part)
    (x_tr, y_tr, _), (x_te, y_te, s_te) = split["train"], split["test"]
    if len(x_tr) < 50 or not x_te:
        raise SystemExit(f"too little data: {len(x_tr)} training weeks, {len(x_te)} held-out weeks")

    params = {"max_iter": 200, "learning_rate": 0.05, "max_leaf_nodes": 15, "min_samples_leaf": 20,
              "l2_regularization": 1.0, "random_state": 7}
    held_out = HistGradientBoostingRegressor(**params).fit(x_tr, y_tr)
    mae_gbm = float(np.mean(np.abs(held_out.predict(x_te) - np.array(y_te))))
    mae_shrink = float(np.mean(np.abs(np.array(s_te) - np.array(y_te))))
    model = HistGradientBoostingRegressor(**params).fit(x_tr + x_te, y_tr + y_te)  # final model on everyone

    ARTIFACT.parent.mkdir(exist_ok=True)
    joblib.dump(model, ARTIFACT)
    better = "beats" if mae_gbm < mae_shrink else "does NOT beat"
    (ARTIFACT.parent / "rate_model_card.md").write_text(f"""# Rate model card ({label} data)

Trained {date.today():%d %b %Y} by `scripts/train_rate_model.py`. scikit-learn HistGradientBoostingRegressor
(the LightGBM algorithm), pooled across riders, predicting next week's season-free log(sen per hour).

| | |
|---|---|
| Data | **{label}**: {len(ids)} riders, {len(x_tr) + len(x_te)} weeks |
| Held-out riders | {len(test_ids)} ({len(x_te)} weeks) |
| MAE, log-rate, pooled model | {mae_gbm:.4f} |
| MAE, log-rate, shrinkage forecast | {mae_shrink:.4f} |
| Verdict | the pooled model **{better}** the shrinkage forecast on held-out riders |

Off by default. Turn it on (RATE_MODEL=gbm) only if it also wins the walk-forward backtest on **real** histories:
`python -m scripts.backtest <csv> --rate-model gbm`. Synthetic numbers say nothing about real riders.
""")
    print(f"{label}: gbm MAE {mae_gbm:.4f} vs shrink {mae_shrink:.4f} on {len(test_ids)} held-out riders → {better}")


if __name__ == "__main__":
    main()
