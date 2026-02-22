"""
Feature building: canonical event table and derived features.
Required canonical columns: ts, platform, market_id, price, trade_size, time_to_resolution_hours,
liquidity_impact, flagged.
Derived: trade_size_log, price_distance_from_50, time_to_resolution_bucket, z_score_trade_size.
Z-score is computed grouped by (platform, market_id).
"""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

# Canonical column names (required in final table)
REQUIRED_COLS = [
    "ts",
    "platform",
    "market_id",
    "price",
    "trade_size",
    "time_to_resolution_hours",
    "liquidity_impact",
    "flagged",
]
DERIVED_COLS = [
    "trade_size_log",
    "price_distance_from_50",
    "time_to_resolution_bucket",
    "z_score_trade_size",
]

# Z-score grouping: per (platform, market_id) by default (trade size varies by market)
Z_SCORE_GROUP_COLS = ["platform", "market_id"]


def _ensure_float(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def _normalize_condition_id(value: object) -> str:
    """
    Normalize conditionId for stable joins across Polymarket sources.
    Keeps a lowercase 0x + 64 hex shape when possible; otherwise returns lowercase text.
    """
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return ""
    raw = str(value).strip().lower()
    if not raw:
        return ""
    if raw.startswith("0x"):
        raw = raw[2:]
    cleaned = re.sub(r"[^a-f0-9]", "", raw)
    if cleaned:
        cleaned = cleaned[:64].zfill(64)
        return "0x" + cleaned
    return str(value).strip().lower()


def _parse_polymarket_trade_ts(series: pd.Series) -> pd.Series:
    """Parse Polymarket trade timestamps that may be in seconds or milliseconds."""
    s = pd.to_numeric(series, errors="coerce")
    if s.dropna().empty:
        return pd.to_datetime(s, errors="coerce", utc=True)
    median_v = float(s.dropna().median())
    unit = "ms" if median_v > 1e12 else "s"
    return pd.to_datetime(s, unit=unit, errors="coerce", utc=True)


def _normalize_api_columns_for_parquet(df: pd.DataFrame) -> pd.DataFrame:
    """
    API passthrough columns can have mixed python objects across sources.
    Normalize object-typed api columns to pandas string dtype so parquet writes reliably.
    """
    out = df.copy()
    for c in out.columns:
        if not (c.startswith("api_") or c.startswith("api_trade_")):
            continue
        if out[c].dtype == object:
            out[c] = out[c].astype("string")
    return out


def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived features. Expects canonical columns to exist."""
    out = df.copy()
    out["trade_size_log"] = np.log1p(out["trade_size"].clip(lower=0))
    out["price_distance_from_50"] = (out["price"] - 0.5).abs()
    # Bucket time to resolution (hours): 0-24, 24-168, 168+ (NaN -> 2)
    th = out["time_to_resolution_hours"]
    out["time_to_resolution_bucket"] = np.where(
        th <= 24, 0, np.where(th <= 168, 1, 2)
    ).astype(int)
    # Z-score of trade_size by group (platform or platform+market_id)
    for col in Z_SCORE_GROUP_COLS:
        if col not in out.columns:
            raise ValueError("Z-score group column missing: %s" % col)
    g = out.groupby(Z_SCORE_GROUP_COLS)["trade_size"]
    mean_ = g.transform("mean")
    std_ = g.transform("std")
    out["z_score_trade_size"] = np.where(
        std_ > 0, (out["trade_size"] - mean_) / std_, 0.0
    )
    return out


def build_events_from_kalshi(
    trades_path: Path,
    markets_path: Path,
) -> pd.DataFrame:
    """
    Build event rows from Kalshi trades + markets.
    Kalshi trade schema: trade_id, ticker, price, count, yes_price, created_time, ...
    Kalshi market schema: ticker, close_time, open_time, volume, liquidity_dollars, ...
    """
    trades = pd.read_parquet(trades_path)
    markets = pd.read_parquet(markets_path)

    # Normalize column names (ingest may have used _normalize_col)
    def has_col(df: pd.DataFrame, *candidates: str) -> str | None:
        for c in candidates:
            if c in df.columns:
                return c
        return None

    # Trades: created_time -> ts, ticker -> market_id, count -> trade_size, yes_price (cents) -> price
    ts_col = has_col(trades, "created_time", "createdtime")
    if not ts_col:
        raise ValueError("Kalshi trades: no 'created_time' column. Columns: %s" % list(trades.columns))
    ticker_col = has_col(trades, "ticker")
    if not ticker_col:
        raise ValueError("Kalshi trades: no 'ticker' column. Columns: %s" % list(trades.columns))
    count_col = has_col(trades, "count", "count_fp")
    if not count_col:
        raise ValueError("Kalshi trades: no 'count' column. Columns: %s" % list(trades.columns))
    price_col = has_col(trades, "yes_price", "yes_price_dollars", "price")
    if not price_col:
        raise ValueError("Kalshi trades: no price column (yes_price/yes_price_dollars/price). Columns: %s" % list(trades.columns))

    events = pd.DataFrame()
    events["ts"] = pd.to_datetime(trades[ts_col], errors="coerce")
    events["platform"] = "kalshi"
    events["market_id"] = trades[ticker_col].astype(str)
    # Yes price: API uses cents (yes_price) or dollars (yes_price_dollars)
    raw_price = trades[price_col]
    if "dollars" in price_col or (raw_price.dtype in (np.float64, float) and raw_price.max() <= 1.5):
        events["price"] = _ensure_float(raw_price)
    else:
        events["price"] = _ensure_float(raw_price) / 100.0
    # Count: may be int or string (count_fp)
    events["trade_size"] = _ensure_float(trades[count_col].astype(str).str.replace(",", ""))

    # Join markets for close_time and liquidity
    mk_ticker = has_col(markets, "ticker")
    if not mk_ticker:
        raise ValueError("Kalshi markets: no 'ticker' column. Columns: %s" % list(markets.columns))
    close_col = has_col(markets, "close_time", "closetime")
    if not close_col:
        raise ValueError(
            "Kalshi markets: no 'close_time' for time_to_resolution. Columns: %s" % list(markets.columns)
        )
    liq_col = has_col(markets, "liquidity_dollars", "liquidity")
    if not liq_col:
        raise ValueError(
            "Kalshi markets: no liquidity field (liquidity_dollars/liquidity). Columns: %s" % list(markets.columns)
        )

    mkt = markets[[mk_ticker, close_col, liq_col]].copy()
    mkt = mkt.rename(columns={mk_ticker: "market_id", close_col: "close_time", liq_col: "liq_raw"})
    mkt["market_id"] = mkt["market_id"].astype(str)
    events = events.merge(mkt, on="market_id", how="left")
    close_ts = pd.to_datetime(events["close_time"], errors="coerce")
    events["time_to_resolution_hours"] = (close_ts - events["ts"]).dt.total_seconds() / 3600.0
    # Liquidity impact: trade_size / (liquidity + 1); liquidity in dollars or raw
    liq = _ensure_float(events["liq_raw"])
    events["liquidity_impact"] = events["trade_size"] / (liq + 1.0)
    events = events.drop(columns=["close_time", "liq_raw"], errors="ignore")

    if "flagged" not in trades.columns:
        events["flagged"] = 0
    else:
        events["flagged"] = trades["flagged"].astype(int).clip(0, 1)

    # Attach all Kalshi API fields for CSV reports (market + trade info)
    mkt_full = markets.copy()
    mkt_full["market_id"] = mkt_full[mk_ticker].astype(str)
    mkt_full = mkt_full.drop_duplicates(subset=["market_id"], keep="first").set_index("market_id")
    for c in mkt_full.columns:
        if c == mk_ticker:
            continue
        events["api_" + c] = events["market_id"].map(mkt_full[c])
    for c in ("trade_id", "taker_side", "yes_price", "no_price", "count", "created_time"):
        if c in trades.columns:
            events["api_trade_" + c] = trades[c].values
    return events


def build_events_from_polymarket_trades(
    trades_path: Path,
    markets_path: Path,
) -> pd.DataFrame:
    """
    Build event rows from Polymarket Data API trades + Gamma markets.
    time_to_resolution_hours = (market endDate - trade timestamp) / 3600.
    If trade timestamp missing, raise. Market liquidity/endDate from Gamma.
    """
    trades = pd.read_parquet(trades_path)
    markets = pd.read_parquet(markets_path)

    def has_col(df: pd.DataFrame, *candidates: str) -> str | None:
        for c in candidates:
            if c in df.columns:
                return c
        return None

    ts_col = has_col(trades, "timestamp")
    if not ts_col:
        raise ValueError(
            "Polymarket trades: no 'timestamp' column. Cannot compute time_to_resolution. Columns: %s"
            % list(trades.columns)
        )
    cid_col = has_col(trades, "conditionid", "condition_id")
    if not cid_col:
        raise ValueError("Polymarket trades: no conditionId. Columns: %s" % list(trades.columns))
    size_col = has_col(trades, "size")
    if not size_col:
        raise ValueError("Polymarket trades: no 'size'. Columns: %s" % list(trades.columns))
    price_col = has_col(trades, "price")
    if not price_col:
        raise ValueError("Polymarket trades: no 'price'. Columns: %s" % list(trades.columns))

    events = pd.DataFrame()
    events["ts"] = _parse_polymarket_trade_ts(trades[ts_col])
    if events["ts"].isna().any():
        raise ValueError(
            "Polymarket trades: some rows have missing or invalid timestamp. "
            "time_to_resolution requires trade timestamp; cannot proceed."
        )
    events["platform"] = "polymarket"
    events["market_id"] = trades[cid_col].map(_normalize_condition_id)
    events["price"] = _ensure_float(trades[price_col])
    events["trade_size"] = _ensure_float(trades[size_col]).fillna(0)

    mk_id = has_col(markets, "conditionid", "condition_id", "id")
    if not mk_id:
        raise ValueError("Polymarket markets: no conditionId/id. Columns: %s" % list(markets.columns))
    end_col = has_col(markets, "enddate", "closedtime", "enddateiso")
    if not end_col:
        raise ValueError(
            "Polymarket markets: no endDate/closedTime for time_to_resolution. Columns: %s"
            % list(markets.columns)
        )
    liq_col = has_col(markets, "liquiditynum", "liquidity")
    if not liq_col:
        raise ValueError("Polymarket markets: no liquidity. Columns: %s" % list(markets.columns))

    mkt = markets[[mk_id, end_col, liq_col]].copy()
    mkt = mkt.rename(columns={mk_id: "market_id", end_col: "end_time", liq_col: "liq_raw"})
    mkt["market_id"] = mkt["market_id"].map(_normalize_condition_id)
    mkt = mkt.drop_duplicates(subset=["market_id"], keep="first")
    events = events.merge(mkt, on="market_id", how="left")
    end_ts = pd.to_datetime(events["end_time"], errors="coerce")
    events["time_to_resolution_hours"] = (end_ts - events["ts"]).dt.total_seconds() / 3600.0
    missing_ttr_ratio = float(events["time_to_resolution_hours"].isna().mean()) if len(events) else 0.0
    if missing_ttr_ratio > 0.10:
        raise ValueError(
            "Polymarket build validation failed: %.2f%% of rows have missing time_to_resolution_hours "
            "(expected <= 10%% after conditionId join). Re-run ingest to refresh "
            "data/raw/polymarket_markets.parquet from Gamma /events, then run build again."
            % (100.0 * missing_ttr_ratio)
        )
    liq = _ensure_float(events["liq_raw"]).fillna(0)
    events["liquidity_impact"] = events["trade_size"] / (liq + 1.0)
    events = events.drop(columns=["end_time", "liq_raw"], errors="ignore")
    events["flagged"] = 0

    # Attach all Polymarket API fields for CSV reports
    mkt_full = markets.copy()
    mkt_full["market_id"] = mkt_full[mk_id].map(_normalize_condition_id)
    mkt_full = mkt_full.drop_duplicates(subset=["market_id"], keep="first").set_index("market_id")
    for c in mkt_full.columns:
        if c == mk_id:
            continue
        events["api_" + c] = events["market_id"].map(mkt_full[c])
    for c in trades.columns:
        if c in (cid_col, ts_col, size_col, price_col):
            continue
        events["api_trade_" + c] = trades[c].values
    return events


def build_events_from_polymarket(markets_path: Path) -> pd.DataFrame:
    """
    Build event rows from Polymarket Gamma markets (snapshots only — one row per market).
    Gamma schema: id, conditionId, endDate, closedTime, volumeNum, liquidityNum, outcomePrices (JSON string).
    No trade-level data; time_to_resolution and trade_size are proxy (market-level).
    """
    df = pd.read_parquet(markets_path)
    # Column names normalized in ingest (lowercase, spaces to underscores)
    id_col = None
    for c in ("id", "conditionid"):
        if c in df.columns:
            id_col = c
            break
    if not id_col:
        raise ValueError("Polymarket markets: no 'id' column. Columns: %s" % list(df.columns))
    ts_col = None
    for c in ("closedtime", "enddate", "updatedat"):
        if c in df.columns:
            ts_col = c
            break
    if not ts_col:
        raise ValueError(
            "Polymarket markets: no time column (closedTime/endDate/updatedAt). Columns: %s" % list(df.columns)
        )
    vol_col = None
    for c in ("volumenum", "volume"):
        if c in df.columns:
            vol_col = c
            break
    if not vol_col:
        raise ValueError("Polymarket markets: no volume (volumeNum/volume). Columns: %s" % list(df.columns))
    liq_col = None
    for c in ("liquiditynum", "liquidity"):
        if c in df.columns:
            liq_col = c
            break
    if not liq_col:
        raise ValueError("Polymarket markets: no liquidity. Columns: %s" % list(df.columns))
    price_col = None
    for c in ("outcomeprices", "lasttradeprice"):
        if c in df.columns:
            price_col = c
            break
    if not price_col:
        raise ValueError("Polymarket markets: no price (outcomePrices/lastTradePrice). Columns: %s" % list(df.columns))

    events = pd.DataFrame()
    events["ts"] = pd.to_datetime(df[ts_col], errors="coerce")
    events["platform"] = "polymarket"
    events["market_id"] = df[id_col].map(_normalize_condition_id)
    # outcomePrices is JSON array e.g. "[\"0.6\", \"0.4\"]" -> use first as yes price
    raw_price = df[price_col]
    if raw_price.dtype == object and raw_price.astype(str).str.startswith("[").any():
        import json
        def first_price(x):
            try:
                arr = json.loads(x) if isinstance(x, str) else x
                return float(arr[0]) if arr else np.nan
            except Exception:
                return np.nan
        events["price"] = raw_price.astype(str).map(first_price)
    else:
        events["price"] = _ensure_float(raw_price)
    events["trade_size"] = _ensure_float(df[vol_col]).fillna(0)
    # No per-trade timestamp in market-only mode; this mode is a last-resort fallback.
    events["time_to_resolution_hours"] = np.nan
    liq = _ensure_float(df[liq_col]).fillna(0)
    events["liquidity_impact"] = events["trade_size"] / (liq + 1.0)
    if "flagged" in df.columns:
        events["flagged"] = df["flagged"].astype(int).clip(0, 1)
    else:
        events["flagged"] = 0
    # Attach all Polymarket Gamma API fields for CSV reports
    for c in df.columns:
        if c in (id_col, ts_col, vol_col, liq_col, price_col):
            continue
        events["api_" + c] = df[c].values
    return events


def _apply_polysights_flags(events: pd.DataFrame, raw_dir: Path) -> pd.DataFrame:
    """
    Use Polysights ingested data to set flagged=1 for Polymarket events whose market
    is marked as feature=True in Polysights (insider-like). Matches Polysights 'market'
    to Gamma market question/title to get conditionId.
    """
    raw_dir = Path(raw_dir)
    polysights_path = raw_dir / "polysights.parquet"
    markets_path = raw_dir / "polymarket_markets.parquet"
    if not polysights_path.exists() or not markets_path.exists():
        return events
    try:
        ps = pd.read_parquet(polysights_path)
        if "feature" not in ps.columns or ps["feature"].sum() == 0:
            return events
        markets = pd.read_parquet(markets_path)
        cid_col = None
        for c in ("conditionid", "condition_id"):
            if c in markets.columns:
                cid_col = c
                break
        q_col = None
        for c in ("question", "title", "slug"):
            if c in markets.columns:
                q_col = c
                break
        if not cid_col or not q_col:
            return events
        def norm(s):
            return (str(s).lower().strip() if pd.notna(s) else "")[:200]
        markets["_n"] = markets[q_col].map(norm)
        markets["_cid"] = markets[cid_col].astype(str)
        flagged_cids = set()
        for _, row in ps.iterrows():
            if not row.get("feature"):
                continue
            mname = norm(row.get("market", ""))
            if not mname:
                continue
            for _, m in markets.iterrows():
                if mname in m["_n"] or m["_n"] in mname:
                    flagged_cids.add(m["_cid"])
        if not flagged_cids:
            return events
        out = events.copy()
        polymask = (out["platform"] == "polymarket") & (out["market_id"].astype(str).isin(flagged_cids))
        out.loc[polymask, "flagged"] = 1
        return out
    except Exception:
        return events


def _join_labels(events: pd.DataFrame, labels_path: Path) -> pd.DataFrame:
    """Join external labels (market_id, ts, flagged) into events. Prefer labels where present."""
    labels_path = Path(labels_path)
    if not labels_path.exists():
        return events
    labels = pd.read_csv(labels_path)
    for c in ("market_id", "ts", "flagged"):
        if c not in labels.columns:
            raise ValueError("Labels file must have columns market_id, ts, flagged. Got: %s" % list(labels.columns))
    labels["ts"] = pd.to_datetime(labels["ts"], errors="coerce")
    labels = labels.dropna(subset=["ts"])
    labels["flagged"] = labels["flagged"].astype(int).clip(0, 1)
    events = events.copy()
    events["_ts_key"] = events["ts"].dt.floor("min")
    labels["_ts_key"] = labels["ts"].dt.floor("min")
    merged = events.merge(
        labels[["market_id", "_ts_key", "flagged"]].rename(columns={"flagged": "flagged_label"}),
        on=["market_id", "_ts_key"],
        how="left",
    )
    merged["flagged"] = merged["flagged_label"].fillna(merged["flagged"]).astype(int)
    merged = merged.drop(columns=["_ts_key", "flagged_label"], errors="ignore")
    return merged


def build_unified_events(
    raw_dir: Path,
    kalshi_trades_path: Path | None = None,
    kalshi_markets_path: Path | None = None,
    polymarket_markets_path: Path | None = None,
    polymarket_trades_path: Path | None = None,
    labels_path: Path | None = None,
) -> pd.DataFrame:
    """
    Build unified event table from raw parquet files.
    Polymarket: use trade-level data (polymarket_trades.parquet + markets) when present;
    otherwise fall back to market-level with warning.
    If labels_path (CSV with market_id, ts, flagged) is provided, join to set flagged.
    """
    raw_dir = Path(raw_dir)
    kalshi_trades_path = kalshi_trades_path or raw_dir / "kalshi_trades.parquet"
    kalshi_markets_path = kalshi_markets_path or raw_dir / "kalshi_markets.parquet"
    polymarket_markets_path = polymarket_markets_path or raw_dir / "polymarket_markets.parquet"
    polymarket_trades_path = polymarket_trades_path or raw_dir / "polymarket_trades.parquet"

    parts = []
    has_kalshi_trades = kalshi_trades_path.exists() and kalshi_markets_path.exists()
    if has_kalshi_trades:
        parts.append(build_events_from_kalshi(kalshi_trades_path, kalshi_markets_path))

    if polymarket_trades_path.exists() and polymarket_markets_path.exists():
        parts.append(build_events_from_polymarket_trades(polymarket_trades_path, polymarket_markets_path))
    elif polymarket_markets_path.exists():
        import warnings
        warnings.warn(
            "Polymarket trade-level data not found; using market-level only. "
            "Insider detection results are not reliable without trade-level data."
        )
        parts.append(build_events_from_polymarket(polymarket_markets_path))

    if not parts:
        raise FileNotFoundError(
            "No raw data found. Run ingest first. Expected Kalshi trades+markets and/or Polymarket data in %s"
            % raw_dir
        )
    combined = pd.concat(parts, ignore_index=True)
    combined = combined.dropna(subset=["ts"])
    if labels_path:
        combined = _join_labels(combined, Path(labels_path))
    combined = add_derived_features(combined)
    combined = _normalize_api_columns_for_parquet(combined)
    return combined
