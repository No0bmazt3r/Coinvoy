"""Correlated income paths and the buffer recursion (FR-ENG-2, FR-ENG-3).

Step 0 is the payday that starts this week: its income is last week's known net. Step t ≥ 1 is next week's payday,
whose income is week t-1's earnings, simulated. So leave in week k shows up as no income at step k + 1, and the Cuti
pot pays the salary at that step.
"""

import numpy as np

from app.engine.forecast import Forecast


def income_paths(fc: Forecast, hours: np.ndarray, n_paths: int, block: int, rng: np.random.Generator) -> np.ndarray:
    """(n_paths, len(hours)) weekly income in sen. Residuals are drawn in blocks of consecutive weeks (a block
    bootstrap), so a run of bad weeks stays a run instead of being shuffled away (ADR-6)."""
    steps = len(hours)
    length = len(fc.residuals)
    n_blocks = -(-steps // block)
    starts = rng.integers(0, length, (n_paths, n_blocks))
    idx = ((starts[:, :, None] + np.arange(block)) % length).reshape(n_paths, -1)[:, :steps]
    level = rng.normal(0, fc.level_sd, (n_paths, 1))  # uncertainty in the rider's true average rate
    return np.exp(fc.log_rate + level + fc.residuals[idx]) * hours


def buffers(b0: int, income: np.ndarray, salary: int, outflows: np.ndarray, cuti_pays: np.ndarray,
            cuti0: int, cuti_in: np.ndarray) -> np.ndarray:
    """(n_paths, steps): the Penampan balance after each step.

    B[t+1] = B[t] + income[t] - salary - outflows[t] + (salary paid from Cuti in leave steps).
    The Cuti pot is deterministic: it grows by cuti_in (the leave set-asides, already inside outflows) and pays
    cuti_pays[t] of a salary (1 = a full week off, 2/6 = two sick days) while it lasts.
    """
    steps = income.shape[1]
    out = np.empty_like(income)
    b = np.full(income.shape[0], float(b0))
    cuti = float(cuti0)
    for t in range(steps):
        cuti += cuti_in[t]
        from_cuti = min(salary * cuti_pays[t], cuti)
        cuti -= from_cuti
        b = b + income[:, t] - salary - outflows[t] + from_cuti
        out[:, t] = b
    return out
