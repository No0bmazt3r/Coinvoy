"""Tier 2: our own trained category model (scripts/train_bm_classifier.py). Loaded once; predicts in < 5 ms."""

from functools import cache
from pathlib import Path

import joblib

ARTIFACT = Path(__file__).parent / "artifacts" / "bm_classifier.joblib"


@cache
def _model():
    return joblib.load(ARTIFACT) if ARTIFACT.exists() else None


def predict(text: str) -> tuple[str, float] | None:
    """(category, probability), or None when no model has been trained."""
    model = _model()
    if model is None:
        return None
    probs = model.predict_proba([text])[0]
    best = int(probs.argmax())
    return str(model.classes_[best]), float(probs[best])
