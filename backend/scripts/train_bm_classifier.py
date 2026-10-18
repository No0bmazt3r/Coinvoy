"""Trains tier 2 of the BM cost parser: TF-IDF (word 1–2-grams + char_wb 2–5-grams) + calibrated logistic regression.

    uv run --directory backend python scripts/train_bm_classifier.py

Writes app/nlp/artifacts/bm_classifier.joblib and model_card.md. Accuracy is reported on the REAL held-out test set
(data/bm_phrases_test.csv) when it has rows; a split of synthetic data is reported separately and labelled as such,
because it says nothing about real riders.
"""

import csv
from collections import Counter
from datetime import date
from pathlib import Path

import joblib
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

ROOT = Path(__file__).resolve().parents[1]
TRAIN = ROOT / "data" / "bm_phrases_train.csv"
TEST = ROOT / "data" / "bm_phrases_test.csv"
ART = ROOT / "app" / "nlp" / "artifacts"


def load(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open() as f:
        return [r for r in csv.DictReader(f) if r.get("text") and r.get("category")]


def build() -> Pipeline:
    features = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), lowercase=True, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), lowercase=True, sublinear_tf=True,
                                 max_features=20_000)),
    ])
    return Pipeline([("features", features),
                     ("clf", CalibratedClassifierCV(LogisticRegression(max_iter=3000, C=4.0), cv=3))])


NO_TEST = ("| Real held-out test set | **none yet**: collect ≥150 real rider phrases (decisions.md E4) "
           "into data/bm_phrases_test.csv |\n")


def main() -> None:
    rows = load(TRAIN)
    test = load(TEST)
    texts, labels = [r["text"] for r in rows], [r["category"] for r in rows]
    sources = Counter(r.get("source", "?") for r in rows)

    x_tr, x_dev, y_tr, y_dev = train_test_split(texts, labels, test_size=0.2, random_state=7, stratify=labels)
    dev_model = build().fit(x_tr, y_tr)
    dev_acc = accuracy_score(y_dev, dev_model.predict(x_dev))

    model = build().fit(texts, labels)  # final model on everything
    ART.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, ART / "bm_classifier.joblib", compress=3)

    real = ""
    if test:
        pred = model.predict([r["text"] for r in test])
        gold = [r["category"] for r in test]
        real = (f"| **Real held-out test set** | {len(test)} phrases | accuracy **{accuracy_score(gold, pred):.1%}**, "
                f"macro-F1 {f1_score(gold, pred, average='macro'):.2f} |\n")
    card = f"""# Model card: BM cost-category classifier (tier 2)

Trained {date.today().isoformat()} by `scripts/train_bm_classifier.py`.

| | |
|---|---|
| Model | TF-IDF (word 1–2-grams + char_wb 2–5-grams) → logistic regression, calibrated (3-fold) |
| Task | Cost phrase → category ({", ".join(sorted(set(labels)))}). \
The amount comes from the rules, never the model. |
| Training data | {len(rows)} phrases: {dict(sources)} |
| Synthetic dev split (20%) | accuracy {dev_acc:.1%}. **Synthetic, not evidence**: \
it only shows the model learned the templates. |
{real or NO_TEST}
## Honest limits
- Until real phrases are added, the training data is a template-generated seed set (`scripts/make_bm_seed.py`).
- Only phrases the rules lexicon can't categorise reach this model; below the confidence threshold they go to the LLM.
- Report only the real held-out number on slides.
"""
    (ART / "model_card.md").write_text(card)
    print(card)


if __name__ == "__main__":
    main()
