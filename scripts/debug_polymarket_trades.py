#!/usr/bin/env python3
"""
One-off debug: call Polymarket Data API /trades by eventId or market and print raw response.
Run from project root:
  python scripts/debug_polymarket_trades.py           # try eventId (first Gamma event)
  python scripts/debug_polymarket_trades.py event     # same
  python scripts/debug_polymarket_trades.py market    # try market=conditionId from parquet
  python scripts/debug_polymarket_trades.py 0x...     # try this conditionId
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA_API = "https://data-api.polymarket.com/trades"
GAMMA_EVENTS = "https://gamma-api.polymarket.com/events"


def main() -> None:
    mode = "event"  # default: try eventId first (usually returns trades)
    if len(sys.argv) > 1:
        arg = sys.argv[1].strip().lower()
        if arg in ("event", "e"):
            mode = "event"
        elif arg in ("market", "m"):
            mode = "market"
        elif arg.startswith("0x") or (len(arg) == 64 and all(c in "0123456789abcdef" for c in arg.lower())):
            mode = "cid"
            condition_id = arg if arg.startswith("0x") else "0x" + arg

    if mode == "event":
        # Fetch one active event from Gamma, then GET /trades?eventId=...
        r = requests.get(GAMMA_EVENTS, params={"limit": 1, "offset": 0, "active": "true", "closed": "false"}, timeout=15)
        r.raise_for_status()
        events = r.json()
        if not events or not isinstance(events, list):
            print("Gamma events: empty or not a list")
            sys.exit(1)
        e = events[0]
        eid = e.get("id")
        if eid is None:
            print("Gamma event has no id. Keys:", list(e.keys()))
            sys.exit(1)
        try:
            eid = int(eid)
        except (TypeError, ValueError):
            pass
        print("Using first Gamma event id:", eid)
        url = DATA_API
        params = {"eventId": eid, "limit": 10, "offset": 0}
        print("GET", url, "params:", params)
        r = requests.get(url, params=params, timeout=15)
        print("Status:", r.status_code)
        try:
            data = r.json()
        except Exception as ex:
            print("Response (first 500 chars):", r.text[:500])
            print("JSON error:", ex)
            sys.exit(1)
        if isinstance(data, list):
            print("Response: list of length", len(data))
            if data:
                print("First trade keys:", list(data[0].keys()))
                print("First trade (redacted):", json.dumps({k: v for k, v in data[0].items() if k not in ("proxyWallet", "maker_address", "transactionHash")}, default=str, indent=2)[:1500])
        else:
            print("Response type:", type(data), "keys:", getattr(data, "keys", lambda: None)())
        return

    if mode == "cid":
        pass  # condition_id set above
    else:
        # market mode: use first conditionId from parquet
        markets_path = ROOT / "data" / "raw" / "polymarket_markets.parquet"
        if not markets_path.exists():
            print("No polymarket_markets.parquet. Run ingest first or pass a conditionId (0x...).")
            sys.exit(1)
        import pandas as pd
        df = pd.read_parquet(markets_path)
        for c in ("conditionid", "condition_id"):
            if c in df.columns:
                condition_id = str(df[c].dropna().iloc[0])
                break
        else:
            print("No conditionId in markets. Columns:", list(df.columns))
            sys.exit(1)
        print("Using first conditionId from parquet:", condition_id[:50], "...")
        if not condition_id.startswith("0x"):
            condition_id = "0x" + (condition_id.lstrip("0").zfill(64) if len(condition_id) <= 64 else condition_id[:64])

    url = DATA_API
    params = {"market": condition_id, "limit": 10, "offset": 0}
    print("GET", url, "params: market=...")
    r = requests.get(url, params=params, timeout=15)
    print("Status:", r.status_code)
    try:
        data = r.json()
    except Exception as e:
        print("Response (first 500 chars):", r.text[:500])
        print("JSON error:", e)
        sys.exit(1)
    if isinstance(data, list):
        print("Response: list of length", len(data))
        if data:
            print("First trade keys:", list(data[0].keys()))
            print("First trade (redacted):", json.dumps({k: v for k, v in data[0].items() if k not in ("proxyWallet", "maker_address", "transactionHash")}, default=str, indent=2)[:1500])
    elif isinstance(data, dict):
        print("Response: dict with keys", list(data.keys()))
    else:
        print("Response type:", type(data))


if __name__ == "__main__":
    main()
