"""
Kalshi ingest: markets and trades via trade-api v2.
Uses key + signature auth (RSA-PSS). Handles cursor-based pagination.
Saves to data/raw/kalshi_*.parquet (separate files for markets and trades).

Optional env vars (for limiting or debugging):
  KALSHI_MARKETS_MAX_PAGES   - stop after N pages of markets (0 = no limit)
  KALSHI_MARKETS_MAX         - stop after N total markets (0 = no limit)
  KALSHI_MARKETS_PAGE_SIZE   - markets per API request (default 100; try 500 if API allows)
  KALSHI_TRADES_MAX_PAGES   - stop after N pages of trades (0 = no limit)
  KALSHI_SAVE_RAW_JSON      - set to 1 to also write each page to data/raw/kalshi/*.json
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from pathlib import Path

import pandas as pd
import requests

from ml_insider.ingest.kalshi_auth import kalshi_headers
from ml_insider.ingest.secrets import get_kalshi_access_key, load_kalshi_private_key

KALSHI_BASE = "https://api.elections.kalshi.com"
PATH_PREFIX = "/trade-api/v2"
DEFAULT_LIMIT = 100
# Kalshi trade-api v2 often caps at 100 per page. Set KALSHI_MARKETS_PAGE_SIZE=500 if your API allows.
try:
    MARKETS_PAGE_LIMIT = max(1, int(os.environ.get("KALSHI_MARKETS_PAGE_SIZE", "100")))
except (TypeError, ValueError):
    MARKETS_PAGE_LIMIT = 100

log = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int | None:
    """Parse env var as int; 0 or unset means use default or no limit."""
    val = os.environ.get(name)
    if val is None or val == "":
        return default
    try:
        n = int(val)
        return n if n > 0 else None
    except ValueError:
        return default


def _get_private_key():
    """Cached private key for signing (load once per process)."""
    if not hasattr(_get_private_key, "_key"):
        _get_private_key._key = load_kalshi_private_key()
    return _get_private_key._key


def _signed_get(path: str, params: dict | None = None) -> requests.Response:
    """GET with Kalshi key + signature. path = e.g. /trade-api/v2/markets (no query)."""
    url = KALSHI_BASE + path
    # Sign path without query string
    path_for_sign = path.split("?")[0]
    headers = kalshi_headers(
        _get_private_key(),
        get_kalshi_access_key(),
        "GET",
        path_for_sign,
    )
    return requests.get(url, params=params, headers=headers, timeout=30)


def _normalize_col(s: str) -> str:
    return s.replace(" ", "_").lower()


def fetch_markets(cursor: str | None = None, limit: int = DEFAULT_LIMIT) -> tuple[list[dict], str | None]:
    """
    GET /trade-api/v2/markets. Returns (markets list, next_cursor or None).
    Response shape: { "markets": [...], "cursor": "..." }
    """
    path = PATH_PREFIX + "/markets"
    params = {"limit": limit}
    if cursor:
        params["cursor"] = cursor
    r = _signed_get(path, params=params)
    r.raise_for_status()
    data = r.json()
    markets = data.get("markets")
    if markets is None:
        raise ValueError("Kalshi /markets response missing 'markets' key")
    next_cursor = data.get("cursor") or None
    if next_cursor == "":
        next_cursor = None
    return markets, next_cursor


def fetch_all_markets(
    max_pages: int | None = None,
    max_markets: int | None = None,
    save_raw_json_dir: Path | None = None,
) -> list[dict]:
    """Paginate through /markets with cursor; optional max_pages / max_markets; optional raw JSON backup."""
    max_pages = max_pages if max_pages is not None else _env_int("KALSHI_MARKETS_MAX_PAGES", 200)
    max_markets = max_markets if max_markets is not None else _env_int("KALSHI_MARKETS_MAX", 0)
    if max_markets == 0:
        max_markets = None
    all_markets = []
    cursor = None
    page = 0
    run_id = uuid.uuid4().hex[:8] if save_raw_json_dir else None
    while True:
        markets, cursor = fetch_markets(cursor=cursor, limit=MARKETS_PAGE_LIMIT)
        all_markets.extend(markets)
        log.info("Fetched %d Kalshi markets (total %d)", len(markets), len(all_markets))
        if save_raw_json_dir and run_id is not None:
            try:
                raw = {"markets": markets, "cursor": cursor}
                (save_raw_json_dir / f"markets_{run_id}_p{page + 1}.json").write_text(
                    json.dumps(raw, indent=2, default=str)
                )
            except Exception as e:
                log.warning("Could not write raw JSON: %s", e)
        if not cursor or not markets:
            break
        page += 1
        if max_pages is not None and page >= max_pages:
            log.info("Stopping at max_pages=%d", max_pages)
            break
        if max_markets is not None and len(all_markets) >= max_markets:
            log.info("Stopping at max_markets=%d", max_markets)
            all_markets = all_markets[:max_markets]
            break
        time.sleep(0.2)
    return all_markets


def fetch_trades(
    cursor: str | None = None,
    limit: int = DEFAULT_LIMIT,
    ticker: str | None = None,
    min_ts: int | None = None,
    max_ts: int | None = None,
) -> tuple[list[dict], str | None]:
    """
    GET /trade-api/v2/markets/trades. Returns (trades list, next_cursor or None).
    """
    path = PATH_PREFIX + "/markets/trades"
    params = {"limit": limit}
    if cursor:
        params["cursor"] = cursor
    if ticker:
        params["ticker"] = ticker
    if min_ts is not None:
        params["min_ts"] = min_ts
    if max_ts is not None:
        params["max_ts"] = max_ts
    r = _signed_get(path, params=params)
    r.raise_for_status()
    data = r.json()
    trades = data.get("trades")
    if trades is None:
        raise ValueError("Kalshi /markets/trades response missing 'trades' key")
    next_cursor = data.get("cursor") or None
    if next_cursor == "":
        next_cursor = None
    return trades, next_cursor


def fetch_all_trades(
    ticker: str | None = None,
    min_ts: int | None = None,
    max_ts: int | None = None,
    max_pages: int | None = None,
) -> list[dict]:
    """Paginate through /markets/trades until cursor is null or max_pages. Env: KALSHI_TRADES_MAX_PAGES."""
    if max_pages is None:
        max_pages = _env_int("KALSHI_TRADES_MAX_PAGES", 500)
    all_trades = []
    cursor = None
    page = 0
    while True:
        trades, cursor = fetch_trades(
            cursor=cursor, limit=DEFAULT_LIMIT, ticker=ticker, min_ts=min_ts, max_ts=max_ts
        )
        all_trades.extend(trades)
        log.info("Fetched %d Kalshi trades (total %d)", len(trades), len(all_trades))
        if not cursor or not trades:
            break
        page += 1
        if max_pages is not None and page >= max_pages:
            log.info("Stopping at max_pages=%d", max_pages)
            break
        time.sleep(0.1)
    return all_trades


def _records_to_df(records: list[dict]) -> pd.DataFrame:
    """Minimal normalization: lowercase underscores for column names."""
    if not records:
        return pd.DataFrame()
    rows = []
    for r in records:
        row = {_normalize_col(k): v for k, v in r.items()}
        rows.append(row)
    return pd.DataFrame(rows)


def run_kalshi_ingest(out_dir: Path) -> tuple[Path, Path]:
    """
    Ingest Kalshi markets and trades; save kalshi_markets.parquet and kalshi_trades.parquet.
    Creates out_dir if needed. Uses env vars for optional limits and raw JSON (see module docstring).
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_json_dir = None
    if os.environ.get("KALSHI_SAVE_RAW_JSON", "").strip() == "1":
        raw_json_dir = out_dir / "kalshi"
        raw_json_dir.mkdir(parents=True, exist_ok=True)
    markets = fetch_all_markets(save_raw_json_dir=raw_json_dir)
    df_m = _records_to_df(markets)
    path_markets = out_dir / "kalshi_markets.parquet"
    df_m.to_parquet(path_markets, index=False)
    log.info("Saved Kalshi markets to %s (%d rows)", path_markets, len(df_m))

    trades = fetch_all_trades()
    df_t = _records_to_df(trades)
    path_trades = out_dir / "kalshi_trades.parquet"
    df_t.to_parquet(path_trades, index=False)
    log.info("Saved Kalshi trades to %s (%d rows)", path_trades, len(df_t))
    return path_markets, path_trades
