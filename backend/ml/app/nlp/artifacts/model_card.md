# Model card: BM cost-category classifier (tier 2)

Trained 2026-10-19 by `scripts/train_bm_classifier.py`.

| | |
|---|---|
| Model | TF-IDF (word 1–2-grams + char_wb 2–5-grams) → logistic regression, calibrated (3-fold) |
| Task | Cost phrase → category (ansuran, keluarga, lain, makan, minyak, motor_tahunan, parking, servis, sewa, telefon, tol). The amount comes from the rules, never the model. |
| Training data | 770 phrases: {'synthetic_seed': 770} |
| Synthetic dev split (20%) | accuracy 98.1%. **Synthetic, not evidence**: it only shows the model learned the templates. |
| Real held-out test set | **none yet**: collect ≥150 real rider phrases (decisions.md E4) into data/bm_phrases_test.csv |

## Honest limits
- Until real phrases are added, the training data is a template-generated seed set (`scripts/make_bm_seed.py`).
- Only phrases the rules lexicon can't categorise reach this model; below the confidence threshold they go to the LLM.
- Report only the real held-out number on slides.
