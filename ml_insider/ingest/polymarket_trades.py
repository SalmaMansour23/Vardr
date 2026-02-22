"""
Polymarket Data API /trades for trade-level ingestion.
Uses https://data-api.polymarket.com/trades (public).
Fetches by eventId (Gamma events) because the API often returns empty for market=conditionId.
Falls back to market=conditionId from polymarket_markets.parquet if event-based fetch is not used.
Saves polymarket_trades.parquet.
"""
from __future__ import annotations

import logging
import os
import re
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests


DATA_API_BASE = "https://data-api.polymarket.com"
GAMMA_BASE = "https://gamma-api.polymarket.com"
TRADES_DAYS = 30
PAGE_LIMIT = 1000
EVENTS_PAGE_LIMIT = 50  # active events to fetch for trade-by-event
FALLBACK_MAX_MARKETS = int(os.environ.get("POLYMARKET_FALLBACK_MAX_MARKETS", "300"))
FALLBACK_MAX_CONSECUTIVE_ERRORS = int(os.environ.get("POLYMARKET_FALLBACK_MAX_CONSECUTIVE_ERRORS", "25"))

log = logging.getLogger(__name__)


def _use_cutoff() -> bool:
    """Set POLYMARKET_TRADES_NO_CUTOFF=1 to disable 30-day filter (for debugging)."""
    return (os.environ.get("POLYMARKET_TRADES_NO_CUTOFF", "").strip().lower() not in ("1", "true", "yes"))


def fetch_gamma_events(limit: int = EVENTS_PAGE_LIMIT, offset: int = 0) -> list[dict]:
    """GET Gamma /events with active=true&closed=false. Returns list of event objects with id."""
    url = f"{GAMMA_BASE}/events"
    params = {"limit": limit, "offset": offset, "active": "true", "closed": "false"}
    r = requests.get(url, params=params, timeout=(10, 30))
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        return []
    return data


def fetch_trades_by_event(
    event_id: int,
    limit: int = PAGE_LIMIT,
    offset: int = 0,
    debug: bool = False,
) -> tuple[list[dict], bool]:
    """GET Data API /trades?eventId=<id>. Returns (trades list, ok). ok=False on 400 (e.g. offset too high)."""
    url = f"{DATA_API_BASE}/trades"
    params = {"eventId": event_id, "limit": limit, "offset": offset}
    r = requests.get(url, params=params, timeout=(15, 60))
    if debug:
        log.info("Polymarket trades request: %s?eventId=%s offset=%s -> status=%d", url, event_id, offset, r.status_code)
    if r.status_code == 400:
        # API often returns 400 for high offset (e.g. offset=4000); treat as end of pages
        return [], False
    r.raise_for_status()
    data = r.json()
    if isinstance(data, list):
        raw_list = data
    elif isinstance(data, dict):
        raw_list = data.get("data") or data.get("trades") or data.get("results") or []
    else:
        raw_list = []
    if not isinstance(raw_list, list):
        raw_list = []
    if debug and raw_list:
        first = raw_list[0]
        log.info("Polymarket trades (eventId=%s): len=%d, first_keys=%s", event_id, len(raw_list), list(first.keys())[:8])
    return raw_list, True


def _normalize_col(s: str) -> str:
    return s.replace(" ", "_").lower()


def _normalize_condition_id(cid: str) -> str:
    """Ensure conditionId is 0x + 64 hex for Data API (Gamma may return with/without 0x)."""
    cid = (cid or "").strip()
    if not cid:
        return cid
    cid = cid.lower()
    if cid.startswith("0x"):
        cid = cid[2:]
    cid = re.sub(r"[^a-f0-9]", "", cid)
    if len(cid) <= 64:
        cid = cid.zfill(64)
    else:
        cid = cid[:64]
    return "0x" + cid


def _trade_timestamp_seconds(t: dict) -> int | None:
    """Get trade time in Unix seconds. API may use timestamp, matchTime, match_time, etc. (seconds or ms)."""
    for key in ("timestamp", "matchTime", "match_time", "last_update", "lastUpdate", "created_at", "time"):
        val = t.get(key)
        if val is None:
            continue
        try:
            n = int(val)
            # If > 1e12 assume milliseconds
            if n > 1e12:
                n = n // 1000
            return n
        except (TypeError, ValueError):
            continue
    return None


def _existing_trades_if_nonempty(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    try:
        df = pd.read_parquet(path)
        return df if len(df) > 0 else pd.DataFrame()
    except Exception:
        return pd.DataFrame()


def _reconstruct_trades_from_processed_events(out_dir: Path) -> pd.DataFrame:
    """
    Offline fallback: rebuild minimal polymarket_trades rows from data/processed/events.parquet
    when APIs are unreachable and no non-empty raw trades file is available.
    """
    processed_events = out_dir.parent / "processed" / "events.parquet"
    if not processed_events.exists():
        return pd.DataFrame()
    try:
        events = pd.read_parquet(processed_events)
        if "platform" not in events.columns:
            return pd.DataFrame()
        pm = events[events["platform"] == "polymarket"].copy()
        if pm.empty:
            return pd.DataFrame()
        out = pd.DataFrame()
        out["conditionid"] = pm["market_id"].astype(str)
        out["size"] = pd.to_numeric(pm["trade_size"], errors="coerce")
        out["price"] = pd.to_numeric(pm["price"], errors="coerce")
        ts = pd.to_datetime(pm["ts"], errors="coerce")
        out["timestamp"] = np.where(ts.notna(), ts.astype("int64") // 10**6, np.nan)
        for c in pm.columns:
            if not c.startswith("api_trade_"):
                continue
            raw_name = c[len("api_trade_"):]
            if raw_name in out.columns:
                continue
            out[raw_name] = pm[c].values
        out = out.dropna(subset=["conditionid", "timestamp"])
        return out.reset_index(drop=True)
    except Exception:
        return pd.DataFrame()


def fetch_trades_for_market(
    condition_id: str,
    limit: int = PAGE_LIMIT,
    offset: int = 0,
    debug: bool = False,
) -> list[dict]:
    """GET /trades?market=<conditionId>&limit=&offset=. Returns list of trade objects."""
    url = f"{DATA_API_BASE}/trades"
    params = {"market": condition_id, "limit": limit, "offset": offset}
    r = requests.get(url, params=params, timeout=(15, 60))
    if debug:
        log.info(
            "Polymarket trades request: %s?%s -> status=%d",
            url,
            "&".join("%s=%s" % (k, v if k != "market" else str(v)[:30] + "...") for k, v in params.items()),
            r.status_code,
        )
    r.raise_for_status()
    data = r.json()
    # Accept array or wrapped { "data": [...] } / { "trades": [...] }
    if isinstance(data, list):
        raw_list = data
    elif isinstance(data, dict):
        raw_list = data.get("data") or data.get("trades") or data.get("results")
        if raw_list is None:
            if debug:
                log.warning("Polymarket trades response keys: %s", list(data.keys()))
            raw_list = []
    else:
        raise ValueError("Data API /trades expected list or dict, got %s" % type(data).__name__)
    if not isinstance(raw_list, list):
        raw_list = []
    if debug and raw_list:
        first = raw_list[0]
        ts_raw = first.get("timestamp") or first.get("match_time") or first.get("matchTime")
        log.info(
            "Polymarket trades response: len=%d, first_keys=%s, timestamp_field=%s",
            len(raw_list),
            list(first.keys())[:10],
            ts_raw,
        )
    return raw_list


def fetch_trades_last_30d_for_market(
    condition_id: str,
    cutoff_ts_seconds: int,
    debug_first_batch: bool = False,
) -> list[dict]:
    """Paginate /trades for one market; keep only trades with timestamp (in seconds) >= cutoff."""
    all_trades = []
    offset = 0
    while True:
        debug = debug_first_batch and offset == 0
        batch = fetch_trades_for_market(condition_id, limit=PAGE_LIMIT, offset=offset, debug=debug)
        if debug_first_batch and offset == 0 and batch:
            first = batch[0]
            ts_val = _trade_timestamp_seconds(first)
            raw_count = len(batch)
            after_filter = sum(
                1 for t in batch
                if _trade_timestamp_seconds(t) is not None and _trade_timestamp_seconds(t) >= cutoff_ts_seconds
            )
            log.info(
                "Polymarket trades (first market): raw_batch=%d, after_30d_filter=%d, cutoff=%d, first_ts_parsed=%s",
                raw_count,
                after_filter,
                cutoff_ts_seconds,
                ts_val,
            )
        if not batch:
            break
        for t in batch:
            ts_sec = _trade_timestamp_seconds(t)
            if ts_sec is not None and ts_sec >= cutoff_ts_seconds:
                all_trades.append(t)
        if len(batch) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT
        time.sleep(0.15)
    return all_trades


def run_polymarket_trades_ingest(out_dir: Path, markets_path: Path | None = None) -> Path:
    """
    Ingest Polymarket trades from Data API for last 30 days.
    Uses eventId (Gamma events) first — Data API often returns empty for market=conditionId.
    Falls back to market=conditionId from markets parquet if event-based returns 0 trades.
    Saves out_dir/polymarket_trades.parquet.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "polymarket_trades.parquet"
    existing_df = _existing_trades_if_nonempty(out_path)
    use_cutoff = _use_cutoff()
    cutoff_ts_seconds = int(time.time() - TRADES_DAYS * 86400) if use_cutoff else 0
    if not use_cutoff:
        log.info("Polymarket trades: 30-day cutoff DISABLED (POLYMARKET_TRADES_NO_CUTOFF=1)")

    # 1) Event-based: fetch active events from Gamma, then trades by eventId
    all_trades = []
    try:
        events = fetch_gamma_events(limit=EVENTS_PAGE_LIMIT, offset=0)
        event_ids = []
        for e in events:
            eid = e.get("id")
            if eid is not None:
                try:
                    event_ids.append(int(eid))
                except (TypeError, ValueError):
                    pass
        if event_ids:
            log.info("Polymarket trades: fetching by eventId for %d events (cutoff=%d)", len(event_ids), cutoff_ts_seconds)
            for i, eid in enumerate(event_ids):
                try:
                    debug = i == 0
                    offset = 0
                    while True:
                        batch, ok = fetch_trades_by_event(eid, limit=PAGE_LIMIT, offset=offset, debug=debug)
                        if not ok:
                            if offset > 0:
                                log.debug("Event %s: 400 at offset %d, stopping pagination", eid, offset)
                            break
                        for t in batch:
                            ts_sec = _trade_timestamp_seconds(t)
                            if ts_sec is not None and ts_sec >= cutoff_ts_seconds:
                                all_trades.append(t)
                        if len(batch) < PAGE_LIMIT:
                            break
                        offset += PAGE_LIMIT
                        time.sleep(0.1)
                    if (i + 1) % 20 == 0:
                        log.info("Trades: %d events done, %d trades so far", i + 1, len(all_trades))
                except requests.HTTPError as e:
                    if e.response is not None and e.response.status_code == 400:
                        log.debug("Event %s: 400, skipping", eid)
                    else:
                        log.warning("Failed to fetch trades for event %s: %s", eid, e)
                except Exception as e:
                    log.warning("Failed to fetch trades for event %s: %s", eid, e)
                time.sleep(0.1)
    except Exception as e:
        log.warning("Event-based Polymarket trades failed: %s", e)

    # 2) Fallback: market=conditionId from markets parquet (often returns empty)
    if not all_trades:
        markets_path = markets_path or out_dir / "polymarket_markets.parquet"
        if markets_path.exists():
            markets_df = pd.read_parquet(markets_path)
            cid_col = None
            for c in ("conditionid", "condition_id"):
                if c in markets_df.columns:
                    cid_col = c
                    break
            if cid_col:
                raw_cids = markets_df[cid_col].dropna().astype(str).unique().tolist()
                condition_ids = [_normalize_condition_id(c) for c in raw_cids]
                if FALLBACK_MAX_MARKETS > 0:
                    condition_ids = condition_ids[:FALLBACK_MAX_MARKETS]
                log.info("Polymarket trades: 0 from events; trying market=conditionId for %d markets", len(condition_ids))
                consecutive_errors = 0
                for i, cid in enumerate(condition_ids):
                    try:
                        debug_first = i == 0
                        trades = fetch_trades_last_30d_for_market(cid, cutoff_ts_seconds, debug_first_batch=debug_first)
                        all_trades.extend(trades)
                        consecutive_errors = 0
                        if (i + 1) % 50 == 0:
                            log.info("Trades: %d markets done, %d trades so far", i + 1, len(all_trades))
                    except Exception as e:
                        consecutive_errors += 1
                        if i < 10 or consecutive_errors % 5 == 0:
                            log.warning("Failed to fetch trades for market %s: %s", cid[:18], e)
                        if consecutive_errors >= FALLBACK_MAX_CONSECUTIVE_ERRORS:
                            log.warning(
                                "Stopping Polymarket market fallback after %d consecutive errors. "
                                "Check network/API reachability and rerun ingest.",
                                consecutive_errors,
                            )
                            break
                    time.sleep(0.1)

    if not all_trades and not existing_df.empty:
        log.warning(
            "Polymarket trades ingest produced 0 rows; keeping existing non-empty file (%d rows): %s",
            len(existing_df),
            out_path,
        )
        return out_path
    if not all_trades:
        df = _reconstruct_trades_from_processed_events(out_dir)
        if not df.empty:
            log.warning(
                "Polymarket trades API unreachable; reconstructed %d rows from data/processed/events.parquet.",
                len(df),
            )
        else:
            df = pd.DataFrame()
    else:
        rows = []
        for t in all_trades:
            row = {_normalize_col(k): v for k, v in t.items()}
            rows.append(row)
        df = pd.DataFrame(rows)
    df.to_parquet(out_path, index=False)
    log.info("Saved Polymarket trades to %s (%d rows)", out_path, len(df))
    return out_path
