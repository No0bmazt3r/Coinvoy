"""The pooled gradient-boosted rate model (ADR-6), trained by scripts/train_rate_model.py.

It predicts next week's season-free log-rate from the rider's recent weeks, pooled across riders. It only replaces the
shrinkage mean when RATE_MODEL=gbm and the artifact exists, and that switch is only flipped if the model beats the
shrinkage forecast in the real backtest (scripts/backtest.py --rate-model gbm). scikit-learn's histogram gradient
boosting is the LightGBM algorithm without a new native dependency.
"""

from functools import cache
from pathlib import Path

import joblib
import numpy as np

ARTIFACT = Path(__file__).parent / "artifacts" / "rate_model.joblib"
MIN_WEEKS = 4  # below this the shrinkage toward the prior is the better guess


def row(logs: np.ndarray, log_prior: float) -> list[float]:
    """Features from the weeks before the one being predicted (oldest first), relative to the prior."""
    return [logs[-1] - log_prior, logs[-4:].mean() - log_prior, logs.mean() - log_prior,
            float(logs[-8:].std()), float(min(len(logs), 26)), log_prior]


@cache
def _model():
    return joblib.load(ARTIFACT) if ARTIFACT.exists() else None


def predict(logs: np.ndarray, log_prior: float) -> float | None:
    model = _model()
    if model is None or len(logs) < MIN_WEEKS:
        return None
    return log_prior + float(model.predict(np.array([row(logs, log_prior)]))[0])
