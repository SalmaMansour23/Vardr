"""Audit helpers for plausibility bias and concentration checks."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pandas as pd

from ml_insider.context.leak_plausibility import compute_leak_plausibility, get_plausibility_config

ENTITY_PATTERNS = [
    (re.compile(r"\biran\b", flags=re.IGNORECASE), "country_a"),
    (re.compile(r"\bisrael\b", flags=re.IGNORECASE), "country_b"),
    (re.compile(r"\btrump\b", flags=re.IGNORECASE), "leader_x"),
    (re.compile(r"\bkhamenei\b", flags=re.IGNORECASE), "leader_y"),
    (re.compile(r"\bgreenland\b", flags=re.IGNORECASE), "territory_z"),
    (re.compile(r"\bsloviansk\b", flags=re.IGNORECASE), "city_q"),
    (re.compile(r"\bjerome powell\b", flags=re.IGNORECASE), "official_a"),
    (re.compile(r"\bmichelle bowman\b", flags=re.IGNORECASE), "official_b"),
]


def _coalesce(df: pd.DataFrame, cols: list[str]) -> pd.Series:
    out = pd.Series([pd.NA] * len(df), index=df.index, dtype=object)
    for c in cols:
        if c in df.columns:
            out = out.where(out.notna(), df[c])
    return out


def _counterfactualize_title(title: Any) -> str:
    text = "" if title is None else str(title)
    for pattern, repl in ENTITY_PATTERNS:
        text = pattern.sub(repl, text)
    return text


def run_plausibility_audit(
    df: pd.DataFrame,
    reports_dir: Path,
    sample_size: int = 20000,
) -> dict[str, Any]:
    reports_dir = Path(reports_dir)
    reports_dir.mkdir(parents=True, exist_ok=True)

    if "market_title" not in df.columns:
        raise ValueError("market_title missing for plausibility audit.")
    if "info_susceptibility_score" not in df.columns:
        raise ValueError("info_susceptibility_score missing for plausibility audit.")

    work = df.copy()
    if sample_size > 0 and len(work) > sample_size:
        work = work.sample(n=sample_size, random_state=42).reset_index(drop=True)
    else:
        work = work.reset_index(drop=True)

    work["market_description"] = _coalesce(
        work,
        ["market_description", "api_description", "api_rules_primary", "api_rules_secondary"],
    ).fillna("")
    work["market_category"] = _coalesce(
        work,
        ["market_category", "api_market_type", "api_event_ticker", "api_event_slug"],
    ).fillna("")
    if "platform" not in work.columns:
        work["platform"] = ""
    if "time_to_resolution_hours" not in work.columns:
        work["time_to_resolution_hours"] = pd.NA

    cf_title = work["market_title"].map(_counterfactualize_title)
    cf_scored = [
        compute_leak_plausibility(t, d, c, h, p)[0]
        for t, d, c, h, p in zip(
            cf_title,
            work["market_description"],
            work["market_category"],
            work["time_to_resolution_hours"],
            work["platform"],
        )
    ]
    work["counterfactual_title"] = cf_title
    work["counterfactual_susceptibility_score"] = cf_scored
    work["counterfactual_abs_delta"] = (
        work["counterfactual_susceptibility_score"] - work["info_susceptibility_score"].astype(float)
    ).abs()

    delta = work["counterfactual_abs_delta"]
    summary: dict[str, Any] = {
        "plausibility_config": get_plausibility_config(),
        "n_rows_audited": int(len(work)),
        "counterfactual_mean_abs_delta": float(delta.mean()),
        "counterfactual_median_abs_delta": float(delta.median()),
        "counterfactual_p95_abs_delta": float(delta.quantile(0.95)),
        "counterfactual_share_abs_delta_ge_0_10": float((delta >= 0.10).mean()),
        "counterfactual_share_abs_delta_ge_0_20": float((delta >= 0.20).mean()),
    }

    if "band" in work.columns:
        escalated = work[work["band"].isin(["INVESTIGATE", "WATCHLIST", "WATCHLIST_QUOTA"])].copy()
        if len(escalated) > 0:
            title_counts = escalated["market_title"].value_counts()
            summary["escalated_rows"] = int(len(escalated))
            summary["escalated_unique_markets"] = int(escalated["market_id"].nunique()) if "market_id" in escalated.columns else None
            summary["escalated_top_title_share"] = float(title_counts.iloc[0] / len(escalated))
            summary["escalated_top5_title_share"] = float(title_counts.head(5).sum() / len(escalated))
        else:
            summary["escalated_rows"] = 0
            summary["escalated_unique_markets"] = 0
            summary["escalated_top_title_share"] = 0.0
            summary["escalated_top5_title_share"] = 0.0

    top_delta = work.sort_values("counterfactual_abs_delta", ascending=False).head(200)
    top_cols = [
        c
        for c in [
            "platform",
            "market_id",
            "market_title",
            "counterfactual_title",
            "info_susceptibility_score",
            "counterfactual_susceptibility_score",
            "counterfactual_abs_delta",
            "band",
        ]
        if c in top_delta.columns
    ]
    top_path = reports_dir / "plausibility_counterfactual_top.csv"
    top_delta.loc[:, top_cols].to_csv(top_path, index=False)

    summary_path = reports_dir / "plausibility_audit_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    return summary
