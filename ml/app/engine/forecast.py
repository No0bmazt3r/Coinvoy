"""Rate × hours forecast (FR-ENG-1, FR-ENG-8).

The rate (RM per hour online) is what the market decides; hours are what the rider decides. The rider's mean
log-rate is shrunk toward the population prior, so 2 weeks of data lean on the prior and 20 weeks lean on the rider.
"""

import json
from dataclasses import dataclass
from datetime import date
from functools import cache
from pathlib import Path

import numpy as np

from app.engine import rate_model as gbm
from app.engine.seasons import log_effect

PRIORS_FILE = Path(__file__).parent / "data" / "priors.json"
SHRINK_K = 4  # weeks of rider data that weigh as much as the prior
OWN_RESIDUALS_MIN = 8  # below this, residuals come from the pooled series (ADR-6)
COLD_START_WEEKS = 4


@dataclass(frozen=True)
class Prior:
    rate_sen_per_hour: int  # population median, net of commission
    log_sd: float  # week-to-week spread of log(rate)
    rho: float  # how strongly one week's luck carries into the next (AR(1))
    default_hours: int


@dataclass(frozen=True)
class WeekObs:
    net_sen: int
    hours: float | None
    week_start: date | None = None  # for the season adjustment; None = treated as an ordinary week


@dataclass(frozen=True)
class Forecast:
    log_rate: float  # shrunk mean log(sen per hour)
    level_sd: float  # uncertainty in that mean, which shrinks as weeks accumulate
    residuals: np.ndarray  # mean-zero log-rate residuals, in time order, for the block bootstrap
    own_residuals: bool
    weeks_used: int

    @property
    def cold_start(self) -> bool:
        return self.weeks_used < COLD_START_WEEKS


@cache
def _priors() -> dict:
    return json.loads(PRIORS_FILE.read_text())


def prior_for(platforms: list[str], city: str | None) -> Prior:
    """Averages the priors of the rider's platforms; a city override wins where one exists."""
    data = _priors()
    rows = [data["platforms"].get(p, data["platforms"]["other"]) for p in platforms] or [data["platforms"]["other"]]
    city_mult = data["city_multiplier"].get((city or "").lower(), 1.0)
    return Prior(
        rate_sen_per_hour=round(np.mean([r["rate_sen_per_hour"] for r in rows]) * city_mult),
        log_sd=float(np.mean([r["log_sd"] for r in rows])),
        rho=data["rho"],
        default_hours=round(np.mean([r["default_hours"] for r in rows])),
    )


@cache
def pooled_residuals(log_sd: float, rho: float) -> np.ndarray:
    """A long AR(1) series with the prior's spread and persistence, so bad spells come in runs.

    ponytail: synthetic until enough consented histories exist; then replace with real pooled residuals.
    """
    rng = np.random.default_rng(20261019)
    n = 520
    eps = rng.normal(0, log_sd * np.sqrt(1 - rho**2), n)
    r = np.empty(n)
    r[0] = rng.normal(0, log_sd)
    for t in range(1, n):
        r[t] = rho * r[t - 1] + eps[t]
    r.setflags(write=False)
    return r - r.mean()


def season_free_logs(history: list[WeekObs], default_hours: float) -> np.ndarray:
    """log(sen per hour) of each week with income, oldest first, with its season effect taken out."""
    obs = [w for w in history if w.net_sen > 0]  # weeks with no income (leave, sick) are skipped
    return np.array([np.log(w.net_sen / (w.hours if w.hours and w.hours > 0 else default_hours))
                     - log_effect(w.week_start) for w in obs])


def fit(history: list[WeekObs], prior: Prior, default_hours: float, rate_model: str = "shrink") -> Forecast:
    """history is oldest first. rate_model "gbm" uses the pooled model for the mean when it's trained (ADR-6)."""
    logs = season_free_logs(history, default_hours)
    n = len(logs)
    log_prior = np.log(prior.rate_sen_per_hour)
    weight = n / (n + SHRINK_K)
    log_rate = weight * logs.mean() + (1 - weight) * log_prior if n else log_prior
    if rate_model == "gbm" and (pred := gbm.predict(logs, float(log_prior))) is not None:
        log_rate = pred
    own = n >= OWN_RESIDUALS_MIN
    residuals = logs - logs.mean() if own else pooled_residuals(prior.log_sd, prior.rho)
    sd = float(logs.std(ddof=1)) if own else prior.log_sd
    return Forecast(log_rate=float(log_rate), level_sd=sd / np.sqrt(n + SHRINK_K), residuals=residuals,
                    own_residuals=own, weeks_used=n)
