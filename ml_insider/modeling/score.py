"""
Scoring: load artifacts, compute anomaly_score, p_informed, risk_score;
assign INVESTIGATE / WATCHLIST bands; filter by 24h/7d/30d; save reports.
"""
from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

from ml_insider.context.leak_plausibility import add_leak_plausibility
from ml_insider.context.plausibility_audit import run_plausibility_audit
from ml_insider.modeling.anomaly import load_anomaly_artifacts, predict_anomaly_score
from ml_insider.modeling.contextual_adjustments import apply_market_crowding_penalty
from ml_insider.modeling.metrics import load_meta

DEFAULT_PROCESSED_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"
DEFAULT_ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "latest"
DEFAULT_REPORTS_DIR = Path(__file__).resolve().parents[2] / "reports"

P_INFORMED_WEIGHT = 0.65
ANOMALY_WEIGHT = 0.35
MIN_FLAGGED_PER_DAY = int(os.getenv("ML_INSIDER_MIN_FLAGGED_PER_DAY", "0"))
PLAUSIBILITY_AUDIT_ENABLED = os.getenv("ML_INSIDER_PLAUSIBILITY_AUDIT", "1").strip().lower() in ("1", "true", "yes")
PLAUSIBILITY_AUDIT_SAMPLE = int(os.getenv("ML_INSIDER_PLAUSIBILITY_AUDIT_SAMPLE", "20000"))
MARKET_CROWDING_ALPHA = float(os.getenv("ML_INSIDER_MARKET_CROWDING_ALPHA", "0.15"))
OUTPUT_COLUMNS = [
    "ts",
    "platform",
    "market_id",
    "market_title",
    "price",
    "trade_size",
    "time_to_resolution_hours",
    "time_to_resolution_bucket",
    "liquidity_impact",
    "z_score_trade_size",
    "price_distance_from_50",
    "trade_size_log",
    "anomaly_score",
    "p_informed",
    "raw_risk",
    "info_susceptibility_score",
    "info_susceptibility_bucket",
    "info_susceptibility_reasons",
    "market_crowding_multiplier",
    "risk_score",
    "band",
    "quota_fill",
    "flagged",
    "pseudo_flagged",
    "wallet",
    "source_trade_id",
]


def _coalesce_columns(df: pd.DataFrame, candidates: list[str]) -> pd.Series:
    out = pd.Series([pd.NA] * len(df), index=df.index, dtype=object)
    for c in candidates:
        if c in df.columns:
            out = out.where(out.notna(), df[c])
    return out


def _format_output(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["market_title"] = _coalesce_columns(
        out,
        ["market_title", "api_question", "api_title", "api_subtitle", "api_slug"],
    )
    out["wallet"] = _coalesce_columns(
        out,
        ["api_trade_proxywallet", "api_trade_wallet", "api_trade_trader", "api_trade_user"],
    )
    out["source_trade_id"] = _coalesce_columns(
        out,
        ["api_trade_trade_id", "api_trade_transactionhash"],
    )
    for c in OUTPUT_COLUMNS:
        if c not in out.columns:
            out[c] = pd.NA
    return out[OUTPUT_COLUMNS]


def _drop_duplicate_source_trades(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Drop exact duplicate trade rows by canonical source trade id."""
    work = df.copy()
    source_id = _coalesce_columns(work, ["api_trade_trade_id", "api_trade_transactionhash", "source_trade_id"])
    has_id = source_id.notna()
    if not has_id.any():
        return work, 0

    with_id = work.loc[has_id].copy()
    with_id["_source_trade_id"] = source_id.loc[has_id].astype(str)
    before = len(with_id)
    with_id = (
        with_id.sort_values("ts")
        .drop_duplicates(subset=["platform", "_source_trade_id"], keep="last")
        .drop(columns=["_source_trade_id"])
    )
    dropped = before - len(with_id)
    without_id = work.loc[~has_id].copy()
    out = pd.concat([with_id, without_id], ignore_index=True).sort_values("ts").reset_index(drop=True)
    return out, int(dropped)


def _build_market_rollup(trades_df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate trade-level alerts into one row per (platform, market_id).
    Uses max-risk trade as the representative row for title/context fields.
    """
    if trades_df.empty:
        return pd.DataFrame(
            columns=[
                "platform",
                "market_id",
                "market_title",
                "latest_ts",
                "market_trade_count",
                "investigate_trade_count",
                "watchlist_trade_count",
                "max_raw_risk",
                "max_risk_score",
                "mean_risk_score",
                "market_band",
                "info_susceptibility_score",
                "info_susceptibility_bucket",
                "info_susceptibility_reasons",
            ]
        )

    key_cols = ["platform", "market_id"]
    rep_cols = [
        "platform",
        "market_id",
        "market_title",
        "band",
        "info_susceptibility_score",
        "info_susceptibility_bucket",
        "info_susceptibility_reasons",
    ]

    rep = (
        trades_df.sort_values("risk_score", ascending=False)
        .drop_duplicates(subset=key_cols, keep="first")
        .loc[:, rep_cols]
        .rename(columns={"band": "market_band"})
    )
    agg = (
        trades_df.groupby(key_cols, as_index=False)
        .agg(
            latest_ts=("ts", "max"),
            market_trade_count=("market_id", "size"),
            investigate_trade_count=("band", lambda s: int((s == "INVESTIGATE").sum())),
            watchlist_trade_count=("band", lambda s: int((s == "WATCHLIST").sum())),
            max_raw_risk=("raw_risk", "max"),
            max_risk_score=("risk_score", "max"),
            mean_risk_score=("risk_score", "mean"),
        )
    )
    out = agg.merge(rep, on=key_cols, how="left")
    return out.sort_values("max_risk_score", ascending=False).reset_index(drop=True)


def run_score(
    processed_dir: Path | None = None,
    artifacts_dir: Path | None = None,
    reports_dir: Path | None = None,
) -> None:
    processed_dir = processed_dir or DEFAULT_PROCESSED_DIR
    artifacts_dir = artifacts_dir or DEFAULT_ARTIFACTS_DIR
    reports_dir = reports_dir or DEFAULT_REPORTS_DIR
    processed_dir = Path(processed_dir)
    artifacts_dir = Path(artifacts_dir)
    reports_dir = Path(reports_dir)
    reports_dir.mkdir(parents=True, exist_ok=True)

    events_path = processed_dir / "events.parquet"
    if not events_path.exists():
        raise FileNotFoundError("Events not found at %s. Run build first." % events_path)
    meta = load_meta(artifacts_dir)
    inv_thresh = float(meta["investigate_threshold"])
    watch_thresh = float(meta["watchlist_threshold"])

    clf, imputer, scaler = load_anomaly_artifacts(artifacts_dir)
    supervised_path = artifacts_dir / "supervised_model.pkl"
    has_supervised = supervised_path.exists()
    supervised = None
    if has_supervised:
        from ml_insider.modeling.supervised import load_supervised_artifacts, predict_p_informed
        supervised = load_supervised_artifacts(artifacts_dir)

    df = pd.read_parquet(events_path)
    df["ts"] = pd.to_datetime(df["ts"])
    df, dropped_dup = _drop_duplicate_source_trades(df)
    if dropped_dup > 0:
        print("Dropped %d duplicate rows by source_trade_id before scoring." % dropped_dup)
    df["anomaly_score"] = predict_anomaly_score(df, clf, imputer, scaler)
    if has_supervised and supervised is not None:
        try:
            df["p_informed"] = predict_p_informed(supervised, df)
        except Exception:
            df["p_informed"] = float("nan")
            has_supervised = False
    else:
        df["p_informed"] = float("nan")

    # Current model risk before contextual downweighting.
    if has_supervised and supervised is not None and "p_informed" in df.columns and not df["p_informed"].isna().all():
        df["raw_risk"] = P_INFORMED_WEIGHT * df["p_informed"] + ANOMALY_WEIGHT * df["anomaly_score"]
    else:
        df["raw_risk"] = df["anomaly_score"]

    # Context columns for market-level leak plausibility.
    df["market_title"] = _coalesce_columns(
        df,
        ["market_title", "api_question", "api_title", "api_subtitle", "api_slug"],
    )
    if df["market_title"].fillna("").astype(str).str.strip().eq("").all():
        raise ValueError(
            "No market_title available at scoring time. Please tell me which field should be used as market title."
        )
    df["market_description"] = _coalesce_columns(
        df,
        ["market_description", "api_description", "api_rules_primary", "api_rules_secondary"],
    ).fillna("")
    df["market_category"] = _coalesce_columns(
        df,
        ["market_category", "api_market_type", "api_event_ticker", "api_event_slug"],
    ).fillna("")

    df = add_leak_plausibility(df)
    base_risk = df["raw_risk"] * df["info_susceptibility_score"]
    risk_score, crowd_mult = apply_market_crowding_penalty(
        df,
        base_risk.values,
        alpha=MARKET_CROWDING_ALPHA,
    )
    df["market_crowding_multiplier"] = crowd_mult
    df["risk_score"] = risk_score
    if MARKET_CROWDING_ALPHA > 0:
        print(
            "Applied market crowding alpha=%.4f (multiplier mean=%.4f min=%.4f)"
            % (
                MARKET_CROWDING_ALPHA,
                float(df["market_crowding_multiplier"].mean()),
                float(df["market_crowding_multiplier"].min()),
            )
        )

    # Bands are always applied on risk_score to align with frontend and threshold selection.
    df["band"] = "LOW"
    df["quota_fill"] = 0
    df.loc[df["risk_score"] >= watch_thresh, "band"] = "WATCHLIST"
    df.loc[df["risk_score"] >= inv_thresh, "band"] = "INVESTIGATE"

    # Guardrail: keep INVESTIGATE strict, but ensure at least N flagged rows per day via WATCHLIST_QUOTA.
    if MIN_FLAGGED_PER_DAY > 0:
        flagged_mask = df["band"].isin(["WATCHLIST", "INVESTIGATE"])
        for day, idx in df.groupby(df["ts"].dt.floor("D")).groups.items():
            day_idx = list(idx)
            n_flagged = int(flagged_mask.loc[day_idx].sum())
            need = MIN_FLAGGED_PER_DAY - n_flagged
            if need <= 0:
                continue
            day_candidates = df.loc[day_idx]
            day_candidates = day_candidates[day_candidates["band"] == "LOW"]
            if day_candidates.empty:
                continue
            fill_idx = day_candidates.sort_values("risk_score", ascending=False).head(need).index
            df.loc[fill_idx, "band"] = "WATCHLIST_QUOTA"
            df.loc[fill_idx, "quota_fill"] = 1
            flagged_mask.loc[fill_idx] = True

    # Audit summary: which markets were downweighted most from raw_risk -> risk_score.
    delta_df = df.copy()
    delta_df["downweight_delta"] = (delta_df["raw_risk"] - delta_df["risk_score"]).clip(lower=0.0)
    top_downweighted = (
        delta_df.sort_values(["downweight_delta", "raw_risk"], ascending=False)
        .loc[
            :,
            [
                "platform",
                "market_id",
                "market_title",
                "raw_risk",
                "risk_score",
                "downweight_delta",
                "info_susceptibility_score",
                "info_susceptibility_bucket",
            ],
        ]
        .drop_duplicates(subset=["platform", "market_id"], keep="first")
        .head(10)
    )
    print("Top 10 downweighted markets (raw_risk - risk_score):")
    if top_downweighted.empty:
        print("  none")
    else:
        print(top_downweighted.to_string(index=False))

    escalated = df[df["band"].isin(["INVESTIGATE", "WATCHLIST", "WATCHLIST_QUOTA"])].copy()
    bucket_counts = (
        escalated.groupby(["band", "info_susceptibility_bucket"]).size().rename("count").reset_index()
        if not escalated.empty
        else pd.DataFrame(columns=["band", "info_susceptibility_bucket", "count"])
    )
    print("Escalation counts by susceptibility bucket:")
    if bucket_counts.empty:
        print("  none")
    else:
        print(bucket_counts.to_string(index=False))

    # Per-platform time windows so both Kalshi and Polymarket appear in 24h/7d/30d
    reports_dir = reports_dir.resolve()
    print("Writing CSVs to: %s" % reports_dir)
    for name, hours in [("24h", 24), ("7d", 24 * 7), ("30d", 24 * 30)]:
        parts = []
        for platform in df["platform"].unique():
            plat_df = df[df["platform"] == platform]
            now_plat = plat_df["ts"].max()
            if pd.isna(now_plat):
                continue
            cutoff = now_plat - pd.Timedelta(hours=hours)
            sub = plat_df[plat_df["ts"] >= cutoff]
            parts.append(sub)
        sub = pd.concat(parts, ignore_index=True) if parts else df.iloc[0:0].copy()
        sort_col = "risk_score" if "risk_score" in sub.columns else "anomaly_score"
        sub = sub.sort_values(sort_col, ascending=False)
        sub = _format_output(sub)
        out_path = (reports_dir / ("suspicious_%s.csv" % name)).resolve()
        sub.to_csv(out_path, index=False)
        by_plat = sub["platform"].value_counts().to_dict() if len(sub) else {}
        print("Saved %s: %d rows -> %s (by platform: %s)" % (name, len(sub), out_path, by_plat))
        market_rollup = _build_market_rollup(sub)
        market_path = (reports_dir / ("suspicious_%s_markets.csv" % name)).resolve()
        market_rollup.to_csv(market_path, index=False)
        print("Saved %s markets: %d rows -> %s" % (name, len(market_rollup), market_path))
    # All events (no time filter)
    sort_col = "risk_score" if "risk_score" in df.columns else "anomaly_score"
    all_events = df.sort_values(sort_col, ascending=False)
    all_events = _format_output(all_events)
    out_path = (reports_dir / "suspicious_all.csv").resolve()
    all_events.to_csv(out_path, index=False)
    by_platform = all_events["platform"].value_counts()
    print("Saved all: %d rows -> %s" % (len(all_events), out_path))
    print("Events by platform in suspicious_all: %s" % by_platform.to_dict())
    all_markets = _build_market_rollup(all_events)
    out_markets = (reports_dir / "suspicious_all_markets.csv").resolve()
    all_markets.to_csv(out_markets, index=False)
    print("Saved all markets: %d rows -> %s" % (len(all_markets), out_markets))

    if PLAUSIBILITY_AUDIT_ENABLED:
        try:
            audit_summary = run_plausibility_audit(
                df,
                reports_dir=reports_dir,
                sample_size=max(0, PLAUSIBILITY_AUDIT_SAMPLE),
            )
            print(
                "Plausibility audit: mean_abs_delta=%.4f p95_abs_delta=%.4f top_title_share=%.4f"
                % (
                    audit_summary.get("counterfactual_mean_abs_delta", 0.0),
                    audit_summary.get("counterfactual_p95_abs_delta", 0.0),
                    audit_summary.get("escalated_top_title_share", 0.0),
                )
            )
        except Exception as e:
            print("Plausibility audit failed: %s" % e)

    # Polysights table with polysights_score (separate report; each model has its own score)
    raw_dir = processed_dir.parent / "raw"
    polysights_path = raw_dir / "polysights.parquet"
    polysights_model_path = artifacts_dir / "polysights_model.pkl"
    if polysights_path.exists() and polysights_model_path.exists():
        try:
            from ml_insider.modeling.polysights_model import load_polysights_artifacts, predict_polysights_score
            ps_df = pd.read_parquet(polysights_path)
            arts = load_polysights_artifacts(artifacts_dir)
            ps_df["polysights_score"] = predict_polysights_score(ps_df, arts)
            out_ps = reports_dir / "polysights_scores.csv"
            ps_df.to_csv(out_ps, index=False)
            print("Saved Polysights scores to %s (%d rows; column polysights_score)" % (out_ps, len(ps_df)))
        except Exception as e:
            print("Polysights scoring failed: %s" % e)

    print("Reports directory (absolute): %s" % reports_dir)
