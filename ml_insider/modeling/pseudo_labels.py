"""
Pseudo-labels from Polymarket wallet behavior (no ground truth).
Used when flagged=1 has no positives so the supervised model can still train.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

WALLET_COL_CANDIDATES = [
    "api_trade_proxywallet",
    "api_trade_trader",
    "api_trade_user",
    "api_trade_wallet",
    "proxywallet",
    "proxy_wallet",
]


def pick_wallet_col(df: pd.DataFrame) -> str | None:
    for c in WALLET_COL_CANDIDATES:
        if c in df.columns:
            return c
    return None


def make_pseudo_labels_from_polymarket_wallets(
    events: pd.DataFrame,
    suspicious_top_pct: float = 0.02,
    min_trades_per_wallet: int = 10,
    score_recent_days: float | None = None,
    score_max_ttr_hours: float | None = None,
    wallet_score_mode: str = "tail",
    min_late_share_24h: float = 0.0,
) -> tuple[pd.DataFrame, dict]:
    """
    Create pseudo labels using Polymarket wallet behavior.
    Returns (events_with_pseudo_flagged, summary_dict).
    """
    df = events.copy()
    df["ts"] = pd.to_datetime(df["ts"], errors="coerce")

    wallet_col = pick_wallet_col(df)
    if wallet_col is None:
        return df, {
            "ok": False,
            "reason": (
                "No Polymarket wallet column found in events table. Expected one of: %s"
                % ", ".join(WALLET_COL_CANDIDATES)
            ),
        }

    pm = df[(df["platform"] == "polymarket") & df[wallet_col].notna()].copy()
    if pm.empty:
        return df, {"ok": False, "reason": "No Polymarket rows with wallet ids available for pseudo-labeling."}

    # Wallet-level features (NO labels required)
    # These are "informed-like" signals: oversized, late, high impact, far-from-50
    pm["timing_risk"] = 1.0 / (pm["time_to_resolution_hours"].clip(lower=0) + 1.0)
    pm["size_risk"] = pm["z_score_trade_size"].clip(lower=0)
    pm["impact_risk"] = pm["liquidity_impact"].clip(lower=0)
    pm["distance_risk"] = pm["price_distance_from_50"].fillna(0).clip(lower=0)

    pm["trade_suspicion"] = (
        0.40 * pm["size_risk"]
        + 0.25 * pm["timing_risk"]
        + 0.20 * pm["impact_risk"]
        + 0.15 * pm["distance_risk"]
    )

    # Optional recency window for wallet scoring (labels still apply to all trades from selected wallets).
    pm_score = pm
    if score_recent_days is not None and float(score_recent_days) > 0:
        cutoff = pm["ts"].max() - pd.Timedelta(days=float(score_recent_days))
        pm_score = pm[pm["ts"] >= cutoff].copy()
        if pm_score.empty:
            return df, {
                "ok": False,
                "reason": "No Polymarket trades in score_recent_days=%s window." % score_recent_days,
            }
    if score_max_ttr_hours is not None and float(score_max_ttr_hours) > 0:
        pm_score = pm_score[pm_score["time_to_resolution_hours"] <= float(score_max_ttr_hours)].copy()
        if pm_score.empty:
            return df, {
                "ok": False,
                "reason": "No Polymarket trades after score_max_ttr_hours=%s filter." % score_max_ttr_hours,
            }

    # Aggregate per wallet: emphasize tail behavior and late timing.
    w = pm_score.groupby(wallet_col).agg(
        n_trades=("trade_suspicion", "size"),
        suspicion_p90=("trade_suspicion", lambda x: float(np.nanpercentile(x, 90))),
        suspicion_p95=("trade_suspicion", lambda x: float(np.nanpercentile(x, 95))),
        suspicion_p99=("trade_suspicion", lambda x: float(np.nanpercentile(x, 99))),
        suspicion_mean=("trade_suspicion", "mean"),
        timing_p95=("timing_risk", lambda x: float(np.nanpercentile(x, 95))),
        timing_mean=("timing_risk", "mean"),
        late_share_24h=("time_to_resolution_hours", lambda s: float((s <= 24).mean())),
        late_share_6h=("time_to_resolution_hours", lambda s: float((s <= 6).mean())),
    ).reset_index()

    w = w[w["n_trades"] >= min_trades_per_wallet].copy()
    min_late_share_24h = float(np.clip(min_late_share_24h, 0.0, 1.0))
    if min_late_share_24h > 0:
        w = w[w["late_share_24h"] >= min_late_share_24h].copy()
    if len(w) < 25:
        return df, {"ok": False, "reason": "Too few wallets with >= %d trades: %d" % (min_trades_per_wallet, len(w))}

    mode = (wallet_score_mode or "tail").strip().lower()
    if mode == "consistent":
        w["wallet_score"] = (
            0.45 * w["suspicion_mean"]
            + 0.25 * w["suspicion_p95"]
            + 0.15 * w["timing_mean"]
            + 0.15 * w["timing_p95"]
        )
    else:
        w["wallet_score"] = (
            0.45 * w["suspicion_p99"]
            + 0.25 * w["suspicion_p95"]
            + 0.10 * w["suspicion_p90"]
            + 0.15 * w["timing_p95"]
            + 0.05 * w["timing_mean"]
        )
    suspicious_top_pct = float(np.clip(suspicious_top_pct, 0.001, 0.5))
    n_pick = max(1, int(np.ceil(len(w) * suspicious_top_pct)))
    suspicious_wallets = set(
        w.sort_values("wallet_score", ascending=False).head(n_pick)[wallet_col].astype(str).tolist()
    )

    df["pseudo_flagged"] = 0
    mask = (df["platform"] == "polymarket") & df[wallet_col].astype(str).isin(suspicious_wallets)
    df.loc[mask, "pseudo_flagged"] = 1

    return df, {
        "ok": True,
        "wallet_col": wallet_col,
        "n_pm_rows": int(len(pm)),
        "n_pm_rows_scored": int(len(pm_score)),
        "n_wallets_used": int(len(w)),
        "suspicious_top_pct": suspicious_top_pct,
        "n_suspicious_wallets": int(len(suspicious_wallets)),
        "pseudo_positives": int(df["pseudo_flagged"].sum()),
        "score_recent_days": float(score_recent_days) if score_recent_days is not None else None,
        "score_max_ttr_hours": float(score_max_ttr_hours) if score_max_ttr_hours is not None else None,
        "wallet_score_mode": mode,
        "min_late_share_24h": min_late_share_24h,
    }
