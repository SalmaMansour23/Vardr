"""
Scrape prediction market table from app.polysights.xyz.
Columns: Market, Spread, Price 12h %, Price 24h %, Bid Ask Spread, Feature.
Uses Playwright for JS-rendered content. Saves to data/raw/polysights.parquet.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path

import pandas as pd

log = logging.getLogger(__name__)

POLYSIGHTS_URL = "https://app.polysights.xyz"


def _parse_pct(s: str) -> float:
    if not s or s.strip() == "":
        return float("nan")
    s = s.strip().replace("%", "").replace(",", "")
    try:
        return float(s)
    except ValueError:
        return float("nan")


def _parse_num(s: str) -> float:
    if not s or s.strip() == "":
        return float("nan")
    s = s.strip().replace(",", "")
    try:
        return float(s)
    except ValueError:
        return float("nan")


def scrape_polysights_playwright() -> list[dict]:
    """Use Playwright to load page and extract table rows. Returns list of row dicts."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log.warning("Playwright not installed. pip install playwright && playwright install chromium")
        return []
    rows = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.goto(POLYSIGHTS_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_selector("tbody tr", timeout=15000)
            trs = page.query_selector_all("tbody tr")
            for tr in trs:
                tds = tr.query_selector_all("td")
                if len(tds) < 5:
                    continue
                market = tds[0].inner_text().strip() if len(tds) > 0 else ""
                spread_s = tds[1].inner_text().strip() if len(tds) > 1 else ""
                p12_s = tds[2].inner_text().strip() if len(tds) > 2 else ""
                p24_s = tds[3].inner_text().strip() if len(tds) > 3 else ""
                bid_ask_s = tds[4].inner_text().strip() if len(tds) > 4 else ""
                feature_s = tds[5].inner_text().strip() if len(tds) > 5 else "False"
                rows.append({
                    "market": market,
                    "spread": _parse_num(spread_s),
                    "price_12h_pct": _parse_pct(p12_s),
                    "price_24h_pct": _parse_pct(p24_s),
                    "bid_ask_spread": _parse_num(bid_ask_s),
                    "feature": str(feature_s).strip().lower() in ("true", "1", "yes"),
                })
        finally:
            browser.close()
    return rows


def run_polysights_ingest(out_dir: Path) -> Path:
    """Scrape Polysights table and save to out_dir/polysights.parquet."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = scrape_polysights_playwright()
    if not rows:
        log.warning("Polysights scrape returned no rows (site may need JS; install playwright).")
        pd.DataFrame(columns=["market", "spread", "price_12h_pct", "price_24h_pct", "bid_ask_spread", "feature"]).to_parquet(
            out_dir / "polysights.parquet", index=False
        )
        return out_dir / "polysights.parquet"
    df = pd.DataFrame(rows)
    out_path = out_dir / "polysights.parquet"
    df.to_parquet(out_path, index=False)
    log.info("Saved Polysights ingest to %s (%d rows)", out_path, len(df))
    return out_path
