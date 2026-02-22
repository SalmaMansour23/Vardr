"""Contextual risk post-processing adjustments."""
from __future__ import annotations

import numpy as np
import pandas as pd


def apply_market_crowding_penalty(
    df: pd.DataFrame,
    risk_scores: np.ndarray,
    alpha: float = 0.0,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Dampen repeated high-risk rows from the same market.

    multiplier = 1 / (1 + alpha * rank_within_market_by_risk)
    rank starts at 0 for the highest-risk row in each (platform, market_id).
    """
    scores = np.asarray(risk_scores, dtype=float)
    n = len(scores)
    if n == 0:
        return scores, np.zeros(0, dtype=float)
    if alpha <= 0.0:
        return scores, np.ones(n, dtype=float)
    if "platform" not in df.columns or "market_id" not in df.columns:
        return scores, np.ones(n, dtype=float)

    work = df[["platform", "market_id"]].copy()
    work["_risk_score"] = scores
    rank = (
        work.groupby(["platform", "market_id"], sort=False)["_risk_score"]
        .rank(method="first", ascending=False)
        .fillna(1.0)
        .to_numpy()
        - 1.0
    )
    mult = 1.0 / (1.0 + float(alpha) * rank)
    adjusted = scores * mult
    return adjusted, mult
