"""
Polymarket ingest: Gamma /events flattened to market rows.
Saves to data/raw/polymarket_markets.parquet. Trade-level data is ingested separately
via Data API in polymarket_trades.py.
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests

GAMMA_BASE = "https://gamma-api.polymarket.com"
DEFAULT_LIMIT = 100
CONNECT_TIMEOUT = 20
READ_TIMEOUT = 45
MAX_RETRIES = 3
RETRY_SLEEP = 2
EVENTS_PAGE_LIMIT = 50

log = logging.getLogger(__name__)


def _normalize_col(s: str) -> str:
    """Minimal column name normalization: lowercase, spaces to underscores."""
    return s.replace(" ", "_").lower()


def _flatten_value(v):
    if isinstance(v, (list, dict)) and not isinstance(v, (str, bytes)):
        return json.dumps(v) if v is not None else None
    return v


def fetch_events(limit: int = EVENTS_PAGE_LIMIT, offset: int = 0) -> list[dict]:
    """
    GET /events with active=true and closed=false.
    Returns list of event objects (each can include nested `markets` list).
    Retries on timeout.
    """
    url = f"{GAMMA_BASE}/events"
    params = {"limit": limit, "offset": offset, "active": "true", "closed": "false"}
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.get(url, params=params, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))
            r.raise_for_status()
            data = r.json()
            if not isinstance(data, list):
                raise ValueError("Gamma API /events expected list, got %s" % type(data).__name__)
            return data
        except (requests.exceptions.ConnectTimeout, requests.exceptions.ReadTimeout, requests.exceptions.ConnectionError) as e:
            last_err = e
            if attempt < MAX_RETRIES - 1:
                log.warning("Gamma /events timeout (attempt %d/%d), retrying in %ds: %s", attempt + 1, MAX_RETRIES, RETRY_SLEEP, e)
                time.sleep(RETRY_SLEEP)
    raise last_err


def fetch_all_events(max_pages: int | None = 200) -> list[dict]:
    """Paginate through Gamma /events using limit/offset until no more or max_pages."""
    all_events = []
    offset = 0
    page = 0
    while True:
        batch = fetch_events(limit=EVENTS_PAGE_LIMIT, offset=offset)
        if not batch:
            break
        all_events.extend(batch)
        log.info("Fetched %d Polymarket events (total %d)", len(batch), len(all_events))
        if len(batch) < EVENTS_PAGE_LIMIT:
            break
        offset += len(batch)
        page += 1
        if max_pages is not None and page >= max_pages:
            break
        time.sleep(0.2)
    return all_events


def events_to_markets_dataframe(events: list[dict]) -> pd.DataFrame:
    """
    Flatten nested event.markets from Gamma /events into a market-level table.
    Keeps market keys normalized and adds selected event metadata with `event_` prefix.
    """
    if not events:
        return pd.DataFrame()
    rows = []
    event_keys = [
        "id",
        "slug",
        "title",
        "question",
        "startDate",
        "endDate",
        "active",
        "closed",
        "archived",
        "updatedAt",
        "createdAt",
    ]
    for event in events:
        if not isinstance(event, dict):
            continue
        event_markets = event.get("markets")
        if not isinstance(event_markets, list):
            continue
        event_meta = {}
        for key in event_keys:
            if key in event:
                event_meta["event_" + _normalize_col(key)] = _flatten_value(event.get(key))
        for market in event_markets:
            row = dict(event_meta)
            if isinstance(market, dict):
                for k, v in market.items():
                    col = _normalize_col(k) if isinstance(k, str) else k
                    row[col] = _flatten_value(v)
            else:
                row["id"] = _flatten_value(market)
            rows.append(row)
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    # Keep one row per conditionId where possible to avoid duplicate join keys in build.
    if "conditionid" in df.columns:
        df = df.drop_duplicates(subset=["conditionid"], keep="first")
    elif "id" in df.columns:
        df = df.drop_duplicates(subset=["id"], keep="first")
    return df.reset_index(drop=True)


def _parse_unix_timestamp(series: pd.Series) -> pd.Series:
    ts_num = pd.to_numeric(series, errors="coerce")
    if ts_num.dropna().empty:
        return pd.to_datetime(ts_num, errors="coerce")
    median_ts = float(ts_num.dropna().median())
    if median_ts > 1e12:
        return pd.to_datetime(ts_num, unit="ms", errors="coerce", utc=True)
    return pd.to_datetime(ts_num, unit="s", errors="coerce", utc=True)


def _reconstruct_markets_from_trades(out_dir: Path) -> pd.DataFrame:
    """
    Offline fallback when Gamma /events is unreachable:
    reconstruct minimal markets table from existing trades so build joins can still run.
    """
    trades_path = out_dir / "polymarket_trades.parquet"
    if not trades_path.exists():
        return pd.DataFrame()
    trades = pd.read_parquet(trades_path)
    if trades.empty:
        return pd.DataFrame()
    cid_col = None
    for c in ("conditionid", "condition_id", "market"):
        if c in trades.columns:
            cid_col = c
            break
    if not cid_col:
        return pd.DataFrame()
    ts_col = None
    for c in ("timestamp", "matchtime", "match_time", "time"):
        if c in trades.columns:
            ts_col = c
            break
    if not ts_col:
        return pd.DataFrame()
    size_col = "size" if "size" in trades.columns else None
    title_col = None
    for c in ("title", "name", "slug", "eventslug"):
        if c in trades.columns:
            title_col = c
            break

    temp = pd.DataFrame()
    temp["conditionid"] = trades[cid_col].astype(str)
    temp["_trade_ts"] = _parse_unix_timestamp(trades[ts_col])
    if size_col:
        temp["_size"] = pd.to_numeric(trades[size_col], errors="coerce")
    else:
        temp["_size"] = np.nan
    if title_col:
        temp["_question"] = trades[title_col].astype(str)
    else:
        temp["_question"] = pd.NA

    grouped = temp.groupby("conditionid", dropna=False).agg(
        last_trade_ts=("_trade_ts", "max"),
        liquiditynum=("_size", lambda x: float(np.nanpercentile(x.dropna(), 75)) * 100.0 if x.dropna().size else 0.0),
        question=("_question", "last"),
    ).reset_index()
    grouped["enddate"] = grouped["last_trade_ts"] + pd.Timedelta(days=7)
    grouped["enddate"] = grouped["enddate"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    grouped["liquiditynum"] = pd.to_numeric(grouped["liquiditynum"], errors="coerce").fillna(0.0)
    grouped["liquidity"] = grouped["liquiditynum"]
    grouped["id"] = grouped["conditionid"]
    return grouped[["id", "conditionid", "question", "enddate", "liquiditynum", "liquidity"]]


def run_polymarket_ingest(out_dir: Path) -> Path:
    """
    Ingest Polymarket markets by flattening Gamma /events nested markets,
    and save to out_dir/polymarket_markets.parquet.
    Creates out_dir if needed.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame()
    try:
        events = fetch_all_events()
        df = events_to_markets_dataframe(events)
    except Exception as e:
        log.warning("Gamma /events ingest unavailable: %s", e)
    if df.empty:
        df = _reconstruct_markets_from_trades(out_dir)
        if not df.empty:
            log.warning(
                "Polymarket /events unavailable. Reconstructed %d markets from local trades for join compatibility.",
                len(df),
            )
    if df.empty:
        raise RuntimeError(
            "Polymarket markets ingest failed: /events unavailable and no local fallback could be built."
        )
    if "conditionid" not in df.columns and "id" not in df.columns:
        raise RuntimeError("Polymarket markets output missing conditionId/id required for joins.")
    out_path = out_dir / "polymarket_markets.parquet"
    df.to_parquet(out_path, index=False)
    log.info("Saved Polymarket markets to %s (%d rows)", out_path, len(df))
    return out_path
