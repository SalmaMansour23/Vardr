from __future__ import annotations

import csv
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


ROOT_DIR = Path(__file__).resolve().parents[1]
REPORTS_DIR = Path(os.getenv("REPORTS_DIR", ROOT_DIR / "reports")).expanduser().resolve()
WINDOW_TO_FILE = {
    "24h": "suspicious_24h.csv",
    "7d": "suspicious_7d.csv",
    "30d": "suspicious_30d.csv",
}
VALID_BANDS = {"ALL", "INVESTIGATE", "WATCHLIST", "LOW"}


app = FastAPI(title="Insider Risk Feed API", version="0.1.0")

# Keep this permissive for local development. Tighten ALLOWED_ORIGINS in production.
allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _to_int(value: Any) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _normalize_row(row: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = dict(row)
    out["risk_score"] = _to_float(row.get("risk_score"))
    out["raw_risk"] = _to_float(row.get("raw_risk"))
    out["anomaly_score"] = _to_float(row.get("anomaly_score"))
    out["p_informed"] = _to_float(row.get("p_informed"))
    out["info_susceptibility_score"] = _to_float(row.get("info_susceptibility_score"))
    out["time_to_resolution_hours"] = _to_float(row.get("time_to_resolution_hours"))
    out["price"] = _to_float(row.get("price"))
    out["trade_size"] = _to_float(row.get("trade_size"))
    out["quota_fill"] = _to_int(row.get("quota_fill"))
    out["flagged"] = _to_int(row.get("flagged"))
    out["pseudo_flagged"] = _to_int(row.get("pseudo_flagged"))
    out["band"] = (row.get("band") or "LOW").upper()
    return out


def _band_match(row_band: str, requested_band: str) -> bool:
    band = (row_band or "LOW").upper()
    if requested_band == "ALL":
        return True
    if requested_band == "INVESTIGATE":
        return band == "INVESTIGATE"
    if requested_band == "WATCHLIST":
        return band in {"WATCHLIST", "WATCHLIST_QUOTA", "INVESTIGATE"}
    if requested_band == "LOW":
        return band == "LOW"
    return True


def _load_rows(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(_normalize_row(row))
    return rows


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "reports_dir": str(REPORTS_DIR)}


@app.get("/api/suspicious")
def get_suspicious(
    window: Literal["24h", "7d", "30d"] = Query(default="24h"),
    band: str = Query(default="ALL"),
    limit: int = Query(default=1000, ge=1, le=50000),
):
    requested_band = band.strip().upper()
    if requested_band not in VALID_BANDS:
        return JSONResponse(
            status_code=400,
            content={
                "error": "invalid_band",
                "message": "band must be one of INVESTIGATE, WATCHLIST, LOW, ALL",
                "band": band,
            },
        )

    csv_path = REPORTS_DIR / WINDOW_TO_FILE[window]
    if not csv_path.exists():
        return JSONResponse(
            status_code=404,
            content={
                "error": "missing_report",
                "message": (
                    f"Could not find {csv_path.name}. Run scoring first: "
                    "python -m ml_insider.cli score"
                ),
                "window": window,
                "path": str(csv_path),
            },
        )

    try:
        rows = _load_rows(csv_path)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "error": "read_failed",
                "message": f"Failed to read CSV: {exc}",
                "window": window,
                "path": str(csv_path),
            },
        )

    filtered = [r for r in rows if _band_match(str(r.get("band", "")), requested_band)]
    filtered.sort(key=lambda r: (r.get("risk_score") is None, -(r.get("risk_score") or 0.0)))

    # API contract requested by user: return an array of rows.
    out = filtered[:limit]

    # Add feed metadata fields directly on each row for lightweight clients.
    updated_at = datetime.fromtimestamp(csv_path.stat().st_mtime, tz=timezone.utc).isoformat()
    generated_at = datetime.now(timezone.utc).isoformat()
    for row in out:
        row["_window"] = window
        row["_source_file"] = csv_path.name
        row["_file_updated_at"] = updated_at
        row["_served_at"] = generated_at

    return out
