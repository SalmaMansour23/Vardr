"""Tests for build/features: add_derived_features, REQUIRED_COLS, build from synthetic data."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from ml_insider.build.features import (
    REQUIRED_COLS,
    add_derived_features,
    build_unified_events,
)


def test_required_cols_defined() -> None:
    assert "ts" in REQUIRED_COLS
    assert "platform" in REQUIRED_COLS
    assert "market_id" in REQUIRED_COLS
    assert "price" in REQUIRED_COLS
    assert "trade_size" in REQUIRED_COLS
    assert "flagged" in REQUIRED_COLS


def test_add_derived_features() -> None:
    df = pd.DataFrame({
        "ts": pd.to_datetime(["2024-01-01 12:00", "2024-01-01 13:00"]),
        "platform": ["kalshi", "kalshi"],
        "market_id": ["A", "A"],
        "price": [0.5, 0.6],
        "trade_size": [10.0, 100.0],
        "time_to_resolution_hours": [24.0, 48.0],
        "liquidity_impact": [0.01, 0.02],
        "flagged": [0, 0],
    })
    out = add_derived_features(df)
    for c in REQUIRED_COLS:
        assert c in out.columns, "missing required column %s" % c
    assert "trade_size_log" in out.columns
    assert "price_distance_from_50" in out.columns
    assert "time_to_resolution_bucket" in out.columns
    assert "z_score_trade_size" in out.columns
    assert out["trade_size_log"].iloc[0] == pytest.approx(np.log1p(10), rel=1e-5)
    assert out["price_distance_from_50"].iloc[0] == 0.0


def test_build_unified_events_requires_data(tmp_path: Path) -> None:
    """With no parquet files in raw dir, build_unified_events raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError, match="No raw data found"):
        build_unified_events(tmp_path)


def test_build_unified_events_with_kalshi_synthetic() -> None:
    raw_dir = Path(__file__).resolve().parents[1] / "data" / "raw"
    kalshi_trades = raw_dir / "kalshi_trades.parquet"
    kalshi_markets = raw_dir / "kalshi_markets.parquet"
    if not kalshi_trades.exists() or not kalshi_markets.exists():
        pytest.skip("Kalshi synthetic data not found (run ingest or create data/raw/kalshi_*.parquet)")
    df = build_unified_events(
        raw_dir,
        kalshi_trades_path=kalshi_trades,
        kalshi_markets_path=kalshi_markets,
        polymarket_markets_path=raw_dir / "__missing_polymarket_markets__.parquet",
        polymarket_trades_path=raw_dir / "__missing_polymarket_trades__.parquet",
    )
    assert len(df) >= 0
    for c in REQUIRED_COLS:
        assert c in df.columns
