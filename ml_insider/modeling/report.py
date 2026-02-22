"""
Generate a human-readable model report: precision/recall metrics, features used, and feature impact.
Writes to reports/model_report.md.
"""
from __future__ import annotations

from pathlib import Path

from ml_insider.modeling.anomaly import STRUCTURAL_FEATURES
from ml_insider.modeling.metrics import load_meta

# Same as supervised.SUPERVISED_FEATURES; avoid importing supervised (pulls in LightGBM)
SUPERVISED_FEATURES = list(STRUCTURAL_FEATURES) + [
    "anomaly_score",
    "size_percentile_market",
    "impact_percentile_market",
    "timing_percentile_market",
    "trade_count_5m_z",
    "trade_count_15m_z",
]

DEFAULT_ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "latest"
DEFAULT_REPORTS_DIR = Path(__file__).resolve().parents[2] / "reports"


def _feature_descriptions() -> dict[str, str]:
    return {
        "z_score_trade_size": "Trade size in standard deviations above/below mean (per platform and market).",
        "liquidity_impact": "Trade size relative to market liquidity (trade_size / (liquidity + 1)).",
        "time_to_resolution_hours": "Hours from trade to market resolution.",
        "price_distance_from_50": "|price - 0.5| (distance from even odds).",
        "trade_size_log": "log(1 + trade_size).",
        "anomaly_score": "IsolationForest anomaly score (0–1, higher = more anomalous).",
        "size_percentile_market": "Trade-size percentile within the same (platform, market_id).",
        "impact_percentile_market": "Liquidity-impact percentile within the same (platform, market_id).",
        "timing_percentile_market": "Percentile rank of -time_to_resolution within the same market (higher = later timing risk).",
        "trade_count_5m_z": "Z-score of rolling 5-minute trade count within the same market.",
        "trade_count_15m_z": "Z-score of rolling 15-minute trade count within the same market.",
    }


def run_report(
    artifacts_dir: Path | None = None,
    reports_dir: Path | None = None,
) -> Path:
    artifacts_dir = artifacts_dir or DEFAULT_ARTIFACTS_DIR
    reports_dir = reports_dir or DEFAULT_REPORTS_DIR
    artifacts_dir = Path(artifacts_dir)
    reports_dir = Path(reports_dir)
    reports_dir.mkdir(parents=True, exist_ok=True)

    meta = load_meta(artifacts_dir)
    mode = meta.get("mode", "unknown")
    lines = [
        "# Model Report",
        "",
        "## 1. Precision and recall (validation set)",
        "",
    ]

    if mode in ("supervised_ground_truth+anomaly", "pseudo_supervised+anomaly", "supervised+anomaly"):
        lines.extend([
            "Metrics are computed on the **validation set** (last 20% of training period by time).",
            "",
            "| Metric | Value |",
            "|--------|-------|",
        ])
        for key in [
            "pr_auc", "brier", "precision_at_50", "precision_at_200",
            "recall_at_80_precision", "recall_at_90_precision",
        ]:
            if key in meta:
                lines.append("| %s | %s |" % (key.replace("_", " ").title(), meta[key]))
        threshold_signal = meta.get("threshold_signal", "risk_score")
        if threshold_signal == "p_informed":
            inv_pct = meta.get("investigate_threshold_percentile", "—")
            watch_pct = meta.get("watchlist_threshold_percentile", "—")
            threshold_lines = [
                "**Thresholds (from validation-set p_informed percentiles):**",
                "- **Investigate threshold (%sth percentile of p_informed):** `%s`" % (inv_pct, meta.get("investigate_threshold", "—")),
                "- **Watchlist threshold (%sth percentile of p_informed):** `%s`" % (watch_pct, meta.get("watchlist_threshold", "—")),
            ]
        elif threshold_signal == "risk_score":
            inv_pct = meta.get("investigate_threshold_percentile", "—")
            watch_pct = meta.get("watchlist_threshold_percentile", "—")
            threshold_lines = [
                "**Thresholds (from validation-set risk_score percentiles):**",
                "- **Investigate threshold (%sth percentile of risk_score):** `%s`" % (inv_pct, meta.get("investigate_threshold", "—")),
                "- **Watchlist threshold (%sth percentile of risk_score):** `%s`" % (watch_pct, meta.get("watchlist_threshold", "—")),
            ]
        else:
            threshold_lines = [
                "**Thresholds (from validation set):**",
                "- **Investigate threshold:** lowest risk threshold achieving ≥ 80% precision. Value: `%s`" % meta.get("investigate_threshold", "—"),
                "- **Watchlist threshold:** lowest risk threshold achieving ≥ 90% recall. Value: `%s`" % meta.get("watchlist_threshold", "—"),
            ]
        lines.extend([
            "",
            *threshold_lines,
            "",
            "**Data splits:** train = %s, validation = %s, test = %s" % (
                meta.get("n_train", "—"), meta.get("n_val", "—"), meta.get("n_test", "—")),
            "",
        ])
    else:
        lines.extend([
            "**Mode:** anomaly-only (no supervised model).",
            "",
            "Precision and recall are **not computed** because there are no labeled positives (flagged=1). "
            "To get precision/recall, add a labels file with `market_id`, `ts`, and `flagged`, then re-run build and train.",
            "",
            "**Thresholds (from anomaly score percentiles):**",
            "- **Investigate threshold (99.5th percentile):** %s" % meta.get("investigate_threshold", "—"),
            "- **Watchlist threshold (99th percentile):** %s" % meta.get("watchlist_threshold", "—"),
            "- **Total events used:** %s" % meta.get("n_events", "—"),
            "",
        ])

    lines.extend([
        "---",
        "",
        "## 2. Features used",
        "",
        "### Anomaly model (IsolationForest)",
        "Uses the following **structural features** only:",
        "",
    ])
    desc = _feature_descriptions()
    for f in STRUCTURAL_FEATURES:
        lines.append("- **%s**: %s" % (f, desc.get(f, "")))
    lines.extend([
        "",
        "### Supervised model (LightGBM, when trained)",
        "Uses the structural features **plus** the anomaly score:",
        "",
    ])
    for f in SUPERVISED_FEATURES:
        lines.append("- **%s**: %s" % (f, desc.get(f, "")))
    lines.extend([
        "",
        "---",
        "",
        "## 3. Feature impact on classification",
        "",
    ])

    gain_path = artifacts_dir / "feature_importance_gain.csv"
    if gain_path.exists():
        import pandas as pd
        df = pd.read_csv(gain_path)
        lines.extend([
            "### LightGBM importance (gain)",
            "Higher gain = feature contributed more to splits in the tree model.",
            "",
            "| Feature | Importance (gain) |",
            "|---------|-------------------|",
        ])
        for _, row in df.iterrows():
            lines.append("| %s | %s |" % (row["feature"], row["importance_gain"]))
        lines.append("")
    else:
        lines.extend([
            "### LightGBM importance (gain)",
            "Not available (supervised model was not trained). `feature_importance_gain.csv` is written only when labels with at least one positive are used.",
            "",
        ])

    shap_path = artifacts_dir / "shap_top.csv"
    if shap_path.exists():
        import pandas as pd
        df = pd.read_csv(shap_path)
        lines.extend([
            "### SHAP (mean absolute impact)",
            "Mean absolute SHAP value per feature; higher = larger average impact on the model output.",
            "",
            "| Feature | Mean abs SHAP |",
            "|---------|---------------|",
        ])
        for _, row in df.iterrows():
            lines.append("| %s | %s |" % (row["feature"], row["mean_abs_shap"]))
        lines.append("")
    else:
        lines.extend([
            "### SHAP",
            "Not available (either supervised model was not trained, or SHAP failed/not installed).",
            "",
        ])

    lines.extend([
        "### Anomaly model (IsolationForest)",
        "IsolationForest does not produce per-feature importances; it uses all structural features above jointly to score anomaly.",
        "",
        "---",
        "",
        "## 4. Per-model scores (you combine)",
        "",
        "Each model outputs its own score. The pipeline does not fix how you combine them.",
        "",
        "| Score column | Model | Where it appears |",
        "|--------------|--------|-------------------|",
        "| `anomaly_score` | IsolationForest | suspicious_*.csv (Kalshi + Polymarket events) |",
        "| `p_informed` | LightGBM (supervised) | suspicious_*.csv when labels exist |",
        "| `polysights_score` | RandomForest on Polysights table | polysights_scores.csv (scraped rows only) |",
        "",
        "`risk_score` in suspicious_*.csv uses `0.65*p_informed + 0.35*anomaly_score` when supervised exists; otherwise `risk_score = anomaly_score`.",
        "",
    ])

    out_path = reports_dir / "model_report.md"
    out_path.write_text("\n".join(lines))
    print("Report written to %s" % out_path.resolve())
    return out_path
