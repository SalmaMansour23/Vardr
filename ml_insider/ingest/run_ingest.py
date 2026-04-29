"""
Run full ingest: Polymarket (Gamma markets + Data API trades) + Kalshi (markets + trades).
Writes to data/raw/ by default. Does not compute ML features.
"""
from __future__ import annotations

import logging
from pathlib import Path

from ml_insider.ingest.kalshi import run_kalshi_ingest
from ml_insider.ingest.polymarket import run_polymarket_ingest
from ml_insider.ingest.polymarket_trades import run_polymarket_trades_ingest
from ml_insider.ingest.polysights import run_polysights_ingest

log = logging.getLogger(__name__)

DEFAULT_RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"


def run_ingest(raw_dir: Path | None = None) -> None:
    raw_dir = raw_dir or DEFAULT_RAW_DIR
    raw_dir = Path(raw_dir)
    try:
        run_polymarket_ingest(raw_dir)
    except Exception as e:
        log.warning("Polymarket markets ingest failed: %s. Continuing with other sources.", e)
    try:
        run_polymarket_trades_ingest(raw_dir)
    except Exception as e:
        log.warning("Polymarket trades ingest failed: %s. Continuing with other sources.", e)
    try:
        run_polysights_ingest(raw_dir)
    except Exception as e:
        log.warning("Polysights ingest failed (optional): %s. Install playwright and run 'playwright install chromium' if you need Polysights.", e)
    try:
        run_kalshi_ingest(raw_dir)
    except Exception as e:
        kalshi_markets = raw_dir / "kalshi_markets.parquet"
        kalshi_trades = raw_dir / "kalshi_trades.parquet"
        if kalshi_markets.exists() and kalshi_trades.exists():
            log.warning(
                "Kalshi ingest failed: %s. Using existing raw files at %s and %s.",
                e,
                kalshi_markets,
                kalshi_trades,
            )
        else:
            raise
    log.info("Ingest complete: %s", raw_dir)
