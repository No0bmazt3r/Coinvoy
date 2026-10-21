# Rate model card (SYNTHETIC data)

Trained 19 Oct 2026 by `scripts/train_rate_model.py`. scikit-learn HistGradientBoostingRegressor
(the LightGBM algorithm), pooled across riders, predicting next week's season-free log(sen per hour).

| | |
|---|---|
| Data | **SYNTHETIC**: 60 riders, 1560 weeks |
| Held-out riders | 12 (312 weeks) |
| MAE, log-rate, pooled model | 0.2125 |
| MAE, log-rate, shrinkage forecast | 0.2201 |
| Verdict | the pooled model **beats** the shrinkage forecast on held-out riders |

Off by default. Turn it on (RATE_MODEL=gbm) only if it also wins the walk-forward backtest on **real** histories:
`python -m scripts.backtest <csv> --rate-model gbm`. Synthetic numbers say nothing about real riders.
