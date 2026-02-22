"""
Write canonical event table to data/processed/events.parquet.
"""
from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from ml_insider.build.features import build_unified_events

log = logging.getLogger(__name__)

DEFAULT_RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"
DEFAULT_PROCESSED_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"


def run_build(
    raw_dir: Path | None = None,
    processed_dir: Path | None = None,
    labels_path: Path | None = None,
) -> Path:
    raw_dir = raw_dir or DEFAULT_RAW_DIR
    processed_dir = processed_dir or DEFAULT_PROCESSED_DIR
    processed_dir = Path(processed_dir)
    processed_dir.mkdir(parents=True, exist_ok=True)
    df = build_unified_events(raw_dir, labels_path=labels_path)
    out_path = processed_dir / "events.parquet"
    df.to_parquet(out_path, index=False)
    log.info("Saved unified events to %s (%d rows)", out_path, len(df))
    by_platform = df["platform"].value_counts()
    print("Events by platform: %s" % by_platform.to_dict())
    if "flagged" in df.columns:
        n_flagged = int((df["flagged"] == 1).sum())
        print("Flagged (ground-truth label rows): %d" % n_flagged)
    if "polymarket" not in by_platform.index and "kalshi" in by_platform.index:
        print("Note: Only Kalshi present. Run ingest to fetch Polymarket (Gamma + Data API trades), then build again.")
    # Warn if Kalshi data looks like synthetic (so user runs ingest for real API data)
    kalshi = df[df["platform"] == "kalshi"] if "platform" in df.columns else pd.DataFrame()
    if len(kalshi) > 0 and kalshi["market_id"].astype(str).str.upper().str.contains("KXTEST", na=False).any():
        print("WARNING: Kalshi market_id contains 'KXTEST' — this is synthetic test data. Run 'ingest' with valid Kalshi API keys to replace with real API data.")
    return out_path
