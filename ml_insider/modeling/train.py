"""
Train anomaly + supervised models and persist artifacts for scoring.
Supervised training uses:
- ground-truth `flagged` labels when available and usable, else
- pseudo labels from Polymarket wallet behavior.
Falls back to anomaly-only if supervised cannot be trained.
"""
from __future__ import annotations

import logging
import os
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from ml_insider.modeling.anomaly import (
    fit_isolation_forest,
    predict_anomaly_score,
    save_anomaly_artifacts,
)
from ml_insider.context.leak_plausibility import add_leak_plausibility, get_plausibility_config
from ml_insider.modeling.metrics import save_meta
from ml_insider.modeling.pseudo_labels import make_pseudo_labels_from_polymarket_wallets
from ml_insider.modeling.contextual_adjustments import apply_market_crowding_penalty

log = logging.getLogger(__name__)

DEFAULT_PROCESSED_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"
DEFAULT_ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "latest"
DEFAULT_REPORTS_DIR = Path(__file__).resolve().parents[2] / "reports"
PSEUDO_TOP_PCT = float(os.getenv("ML_INSIDER_PSEUDO_TOP_PCT", "0.17"))
PSEUDO_MIN_TRADES_PER_WALLET = int(os.getenv("ML_INSIDER_PSEUDO_MIN_TRADES", "10"))
PSEUDO_SCORE_RECENT_DAYS = float(os.getenv("ML_INSIDER_PSEUDO_SCORE_RECENT_DAYS", "7"))
PSEUDO_SCORE_MAX_TTR_HOURS = float(os.getenv("ML_INSIDER_PSEUDO_SCORE_MAX_TTR_HOURS", "0"))
PSEUDO_WALLET_SCORE_MODE = os.getenv("ML_INSIDER_PSEUDO_WALLET_SCORE_MODE", "tail").strip().lower() or "tail"
PSEUDO_MIN_LATE_SHARE_24H = float(os.getenv("ML_INSIDER_PSEUDO_MIN_LATE_SHARE_24H", "0"))
SUPERVISED_WEIGHT_POSITIVE = float(os.getenv("ML_INSIDER_SUPERVISED_WEIGHT_POSITIVE", "20.0"))
SUPERVISED_INVESTIGATE_PERCENTILE = float(os.getenv("ML_INSIDER_INVESTIGATE_PERCENTILE", "99.09"))
SUPERVISED_WATCHLIST_PERCENTILE = float(os.getenv("ML_INSIDER_WATCHLIST_PERCENTILE", "98.19"))
SUPERVISED_PLATFORM_SCOPE = os.getenv("ML_INSIDER_SUPERVISED_PLATFORM_SCOPE", "all").strip().lower() or "all"
MARKET_CROWDING_ALPHA = float(os.getenv("ML_INSIDER_MARKET_CROWDING_ALPHA", "0.15"))


def _remove_if_exists(path: Path) -> None:
    if path.exists():
        path.unlink()


def _to_binary(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0).astype(int).clip(0, 1)


def _coalesce_columns(df: pd.DataFrame, candidates: list[str]) -> pd.Series:
    out = pd.Series([pd.NA] * len(df), index=df.index, dtype=object)
    for c in candidates:
        if c in df.columns:
            out = out.where(out.notna(), df[c])
    return out


def _with_required_metric_aliases(metrics: dict) -> dict:
    out = dict(metrics)
    out["PR-AUC"] = out.get("pr_auc", 0.0)
    out["Brier"] = out.get("brier", 0.0)
    out["Precision@50"] = out.get("precision_at_50", 0.0)
    out["Precision@200"] = out.get("precision_at_200", 0.0)
    out["Recall@80% precision"] = out.get("recall_at_80_precision", 0.0)
    out["Recall@90% precision"] = out.get("recall_at_90_precision", 0.0)
    return out


def _append_precision_tuning_log(metrics: dict) -> None:
    reports_dir = DEFAULT_REPORTS_DIR
    reports_dir.mkdir(parents=True, exist_ok=True)
    out_path = reports_dir / "precision_tuning_log.jsonl"
    plaus_cfg = get_plausibility_config()
    payload = {
        "ts_utc": datetime.now(timezone.utc).isoformat(),
        "mode": metrics.get("mode"),
        "supervised_base_model": metrics.get("supervised_base_model"),
        "calibration_method": metrics.get("calibration_method"),
        "precision_at_50": metrics.get("Precision@50", metrics.get("precision_at_50")),
        "precision_at_200": metrics.get("Precision@200", metrics.get("precision_at_200")),
        "precision_at_50_context": metrics.get("precision_at_50_context"),
        "precision_at_200_context": metrics.get("precision_at_200_context"),
        "pr_auc": metrics.get("PR-AUC", metrics.get("pr_auc")),
        "brier": metrics.get("Brier", metrics.get("brier")),
        "recall_at_80_precision": metrics.get("Recall@80% precision", metrics.get("recall_at_80_precision")),
        "recall_at_90_precision": metrics.get("Recall@90% precision", metrics.get("recall_at_90_precision")),
        "investigate_threshold": metrics.get("investigate_threshold"),
        "watchlist_threshold": metrics.get("watchlist_threshold"),
        "threshold_signal": metrics.get("threshold_signal"),
        "investigate_band_share_val": metrics.get("investigate_band_share_val"),
        "watchlist_band_share_val": metrics.get("watchlist_band_share_val"),
        "investigate_precision_val": metrics.get("investigate_precision_val"),
        "investigate_recall_val": metrics.get("investigate_recall_val"),
        "watchlist_precision_val": metrics.get("watchlist_precision_val"),
        "watchlist_recall_val": metrics.get("watchlist_recall_val"),
        "n_train": metrics.get("n_train"),
        "n_val": metrics.get("n_val"),
        "n_test": metrics.get("n_test"),
        "n_events": metrics.get("n_events"),
        "tuning": {
            "pseudo_top_pct": PSEUDO_TOP_PCT,
            "pseudo_min_trades_per_wallet": PSEUDO_MIN_TRADES_PER_WALLET,
            "pseudo_score_recent_days": PSEUDO_SCORE_RECENT_DAYS,
            "pseudo_score_max_ttr_hours": PSEUDO_SCORE_MAX_TTR_HOURS,
            "pseudo_wallet_score_mode": PSEUDO_WALLET_SCORE_MODE,
            "pseudo_min_late_share_24h": PSEUDO_MIN_LATE_SHARE_24H,
            "weight_positive": SUPERVISED_WEIGHT_POSITIVE,
            "investigate_percentile": SUPERVISED_INVESTIGATE_PERCENTILE,
            "watchlist_percentile": SUPERVISED_WATCHLIST_PERCENTILE,
            "use_extra_structural_features": os.getenv("ML_INSIDER_USE_EXTRA_STRUCTURAL_FEATURES", "0"),
            "supervised_platform_scope": SUPERVISED_PLATFORM_SCOPE,
            "lgbm_n_estimators": os.getenv("ML_INSIDER_LGBM_N_ESTIMATORS", "400"),
            "lgbm_learning_rate": os.getenv("ML_INSIDER_LGBM_LEARNING_RATE", "0.05"),
            "lgbm_max_depth": os.getenv("ML_INSIDER_LGBM_MAX_DEPTH", "6"),
            "lgbm_num_leaves": os.getenv("ML_INSIDER_LGBM_NUM_LEAVES", "31"),
            "lgbm_min_data_in_leaf": os.getenv("ML_INSIDER_LGBM_MIN_DATA_IN_LEAF", "40"),
            "lgbm_reg_lambda": os.getenv("ML_INSIDER_LGBM_REG_LAMBDA", "0.0"),
            "lgbm_reg_alpha": os.getenv("ML_INSIDER_LGBM_REG_ALPHA", "0.0"),
            "lgbm_min_gain_to_split": os.getenv("ML_INSIDER_LGBM_MIN_GAIN_TO_SPLIT", "0.0"),
            "plausibility_profile": plaus_cfg.get("profile"),
            "plausibility_max_rule_uplift": plaus_cfg.get("max_rule_uplift"),
            "market_crowding_alpha": MARKET_CROWDING_ALPHA,
        },
    }
    with open(out_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload, default=float) + "\n")


def run_train(
    processed_dir: Path | None = None,
    artifacts_dir: Path | None = None,
) -> None:
    processed_dir = processed_dir or DEFAULT_PROCESSED_DIR
    artifacts_dir = artifacts_dir or DEFAULT_ARTIFACTS_DIR
    processed_dir = Path(processed_dir)
    artifacts_dir = Path(artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    events_path = processed_dir / "events.parquet"
    if not events_path.exists():
        raise FileNotFoundError("Events not found at %s. Run build first." % events_path)
    df = pd.read_parquet(events_path)
    if len(df) < 1000:
        print("WARNING: Fewer than 1000 rows (%d). Results may be unreliable." % len(df))

    mode = "anomaly_only"
    label_col: str | None = None

    # 1) Model 1: IsolationForest anomaly model (always)
    clf, imputer, scaler = fit_isolation_forest(df, contamination=0.01)
    save_anomaly_artifacts(clf, imputer, scaler, artifacts_dir)
    df["anomaly_score"] = predict_anomaly_score(df, clf, imputer, scaler)

    # 2) Label strategy:
    #    a) ground-truth labels if available and usable
    #    b) pseudo labels from Polymarket wallets otherwise
    if "flagged" in df.columns:
        df["flagged"] = _to_binary(df["flagged"])
        n_pos = int(df["flagged"].sum())
        n_neg = int((df["flagged"] == 0).sum())
        if n_pos > 0 and n_neg > 0:
            label_col = "flagged"
            mode = "supervised_ground_truth+anomaly"
            print("Using provided ground-truth labels: %d positives, %d negatives." % (n_pos, n_neg))
    if label_col is None:
        df, pseudo_summary = make_pseudo_labels_from_polymarket_wallets(
            df,
            suspicious_top_pct=PSEUDO_TOP_PCT,
            min_trades_per_wallet=PSEUDO_MIN_TRADES_PER_WALLET,
            score_recent_days=PSEUDO_SCORE_RECENT_DAYS if PSEUDO_SCORE_RECENT_DAYS > 0 else None,
            score_max_ttr_hours=PSEUDO_SCORE_MAX_TTR_HOURS if PSEUDO_SCORE_MAX_TTR_HOURS > 0 else None,
            wallet_score_mode=PSEUDO_WALLET_SCORE_MODE,
            min_late_share_24h=PSEUDO_MIN_LATE_SHARE_24H,
        )
        if pseudo_summary.get("ok"):
            df["pseudo_flagged"] = _to_binary(df["pseudo_flagged"])
            n_pos = int(df["pseudo_flagged"].sum())
            n_neg = int((df["pseudo_flagged"] == 0).sum())
            if n_pos > 0 and n_neg > 0:
                label_col = "pseudo_flagged"
                mode = "pseudo_supervised+anomaly"
                print(
                    "Using Polymarket pseudo-labels: %d positives (%d suspicious wallets, wallet field: %s)."
                    % (
                        n_pos,
                        int(pseudo_summary.get("n_suspicious_wallets", 0)),
                        pseudo_summary.get("wallet_col", "unknown"),
                    )
                )
            else:
                print("Pseudo-labeling produced unusable class split (pos=%d, neg=%d)." % (n_pos, n_neg))
        else:
            print("Pseudo-labeling unavailable: %s" % pseudo_summary.get("reason", "unknown reason"))

    run_supervised = label_col is not None
    if run_supervised and label_col is not None:
        # 3) Model 2: LightGBM supervised + sigmoid calibration
        try:
            from ml_insider.modeling.explain import compute_shap_top, save_feature_importance_gain
            from ml_insider.modeling.metrics import compute_validation_metrics, precision_at_k
            from ml_insider.modeling.supervised import (
                SUPERVISED_FEATURES,
                build_supervised_feature_frame,
                fit_supervised,
                predict_p_informed,
                save_supervised_artifacts,
            )

            supervised_df = df
            if label_col == "pseudo_flagged" and SUPERVISED_PLATFORM_SCOPE == "polymarket":
                supervised_df = df[df["platform"] == "polymarket"].copy()
                if supervised_df.empty:
                    raise ValueError("No Polymarket rows available for supervised pseudo-label training.")

            calibrated, train_df, val_df, test_df = fit_supervised(
                supervised_df,
                train_frac=0.8,
                val_frac_of_train=0.2,
                weight_positive=SUPERVISED_WEIGHT_POSITIVE,
                label_col=label_col,
            )
            save_supervised_artifacts(calibrated, artifacts_dir)

            y_val = val_df[label_col].astype(int).values
            p_val = predict_p_informed(calibrated, val_df)
            raw_risk_val = 0.65 * p_val + 0.35 * val_df["anomaly_score"].values
            val_context = val_df.copy()
            val_context["market_title"] = _coalesce_columns(
                val_context,
                ["market_title", "api_question", "api_title", "api_subtitle", "api_slug"],
            )
            if val_context["market_title"].fillna("").astype(str).str.strip().eq("").all():
                raise ValueError(
                    "No market_title available in validation split. Please provide title column mapping."
                )
            val_context["market_description"] = _coalesce_columns(
                val_context,
                ["market_description", "api_description", "api_rules_primary", "api_rules_secondary"],
            ).fillna("")
            val_context["market_category"] = _coalesce_columns(
                val_context,
                ["market_category", "api_market_type", "api_event_ticker", "api_event_slug"],
            ).fillna("")
            val_context = add_leak_plausibility(val_context)
            risk_val_base = raw_risk_val * val_context["info_susceptibility_score"].values
            risk_val, crowd_mult = apply_market_crowding_penalty(
                val_context,
                risk_val_base,
                alpha=MARKET_CROWDING_ALPHA,
            )
            metrics = compute_validation_metrics(y_val, p_val)
            metrics["precision_at_50_context"] = precision_at_k(y_val, risk_val, 50)
            metrics["precision_at_200_context"] = precision_at_k(y_val, risk_val, 200)
            inv_thresh = float(np.percentile(risk_val, SUPERVISED_INVESTIGATE_PERCENTILE))
            watch_thresh = float(np.percentile(risk_val, SUPERVISED_WATCHLIST_PERCENTILE))
            metrics = _with_required_metric_aliases(metrics)
            metrics["investigate_threshold"] = float(inv_thresh)
            metrics["watchlist_threshold"] = float(watch_thresh)
            metrics["threshold_signal"] = "risk_score_contextual"
            metrics["investigate_threshold_percentile"] = SUPERVISED_INVESTIGATE_PERCENTILE
            metrics["watchlist_threshold_percentile"] = SUPERVISED_WATCHLIST_PERCENTILE
            inv_mask = risk_val >= inv_thresh
            watch_mask = risk_val >= watch_thresh
            n_pos_val = int(np.sum(y_val))
            metrics["n_val_pos"] = n_pos_val
            metrics["investigate_band_share_val"] = float(np.mean(inv_mask)) if len(inv_mask) else 0.0
            metrics["watchlist_band_share_val"] = float(np.mean(watch_mask)) if len(watch_mask) else 0.0
            metrics["investigate_precision_val"] = float(np.mean(y_val[inv_mask])) if np.any(inv_mask) else 0.0
            metrics["watchlist_precision_val"] = float(np.mean(y_val[watch_mask])) if np.any(watch_mask) else 0.0
            metrics["investigate_recall_val"] = (
                float(np.sum(y_val[inv_mask]) / n_pos_val) if n_pos_val > 0 else 0.0
            )
            metrics["watchlist_recall_val"] = (
                float(np.sum(y_val[watch_mask]) / n_pos_val) if n_pos_val > 0 else 0.0
            )
            metrics["n_train"] = int(len(train_df))
            metrics["n_val"] = int(len(val_df))
            metrics["n_test"] = int(len(test_df))
            metrics["mode"] = mode
            metrics["label_col"] = label_col
            metrics["supervised_base_model"] = getattr(calibrated, "ml_insider_base_model", "unknown")
            metrics["calibration_method"] = getattr(calibrated, "ml_insider_calibration_method", "unknown")
            metrics["plausibility_profile"] = get_plausibility_config().get("profile")
            metrics["plausibility_max_rule_uplift"] = get_plausibility_config().get("max_rule_uplift")
            metrics["market_crowding_alpha"] = MARKET_CROWDING_ALPHA
            metrics["market_crowding_multiplier_mean"] = float(np.mean(crowd_mult)) if len(crowd_mult) else 1.0
            metrics["market_crowding_multiplier_min"] = float(np.min(crowd_mult)) if len(crowd_mult) else 1.0
            save_meta(metrics, artifacts_dir)

            save_feature_importance_gain(calibrated, artifacts_dir)
            val_X_for_shap = build_supervised_feature_frame(val_df)
            shap_path = compute_shap_top(calibrated, val_X_for_shap[SUPERVISED_FEATURES], artifacts_dir)
            if shap_path:
                log.info("SHAP saved to %s", shap_path)
            else:
                log.info("SHAP skipped (not installed or failed)")

            print("Validation metrics:")
            print("  PR-AUC: %s" % metrics["PR-AUC"])
            print("  Brier: %s" % metrics["Brier"])
            print("  Precision@50: %s" % metrics["Precision@50"])
            print("  Precision@200: %s" % metrics["Precision@200"])
            print("  Precision@50 (contextual risk): %s" % metrics["precision_at_50_context"])
            print("  Precision@200 (contextual risk): %s" % metrics["precision_at_200_context"])
            print("  Recall@80%% precision: %s" % metrics["Recall@80% precision"])
            print("  Recall@90%% precision: %s" % metrics["Recall@90% precision"])
            print(
                "  Investigate threshold (contextual risk_val %.1fth percentile): %s"
                % (SUPERVISED_INVESTIGATE_PERCENTILE, metrics["investigate_threshold"])
            )
            print(
                "  Watchlist threshold (contextual risk_val %.1fth percentile): %s"
                % (SUPERVISED_WATCHLIST_PERCENTILE, metrics["watchlist_threshold"])
            )
            print("  Investigate val band share: %.6f" % metrics["investigate_band_share_val"])
            print("  Watchlist val band share: %.6f" % metrics["watchlist_band_share_val"])
            print("  Investigate val precision: %s" % metrics["investigate_precision_val"])
            print("  Investigate val recall: %s" % metrics["investigate_recall_val"])
            print("  Validation positives: %d" % metrics["n_val_pos"])
            print(
                "  Tunables -> pseudo_top_pct: %s, pseudo_min_trades: %s, pseudo_score_recent_days: %s, pseudo_score_max_ttr_hours: %s, pseudo_wallet_score_mode: %s, pseudo_min_late_share_24h: %s, weight_positive: %s, supervised_platform_scope: %s"
                % (
                    PSEUDO_TOP_PCT,
                    PSEUDO_MIN_TRADES_PER_WALLET,
                    PSEUDO_SCORE_RECENT_DAYS,
                    PSEUDO_SCORE_MAX_TTR_HOURS,
                    PSEUDO_WALLET_SCORE_MODE,
                    PSEUDO_MIN_LATE_SHARE_24H,
                    SUPERVISED_WEIGHT_POSITIVE,
                    SUPERVISED_PLATFORM_SCOPE,
                )
            )
            print("  Split sizes -> train: %d, val: %d, test: %d" % (metrics["n_train"], metrics["n_val"], metrics["n_test"]))
            print("  Supervised base model: %s" % metrics["supervised_base_model"])
            print("  Calibration method: %s" % metrics["calibration_method"])
            _append_precision_tuning_log(metrics)
        except (ImportError, OSError) as e:
            log.warning("Supervised training unavailable (LightGBM/libomp?): %s. Falling back to anomaly-only.", e)
            run_supervised = False
        except Exception as e:
            log.warning("Supervised training failed: %s. Falling back to anomaly-only.", e)
            run_supervised = False

    if not run_supervised:
        # Ensure no stale supervised artifacts remain from older runs.
        _remove_if_exists(artifacts_dir / "supervised_model.pkl")
        _remove_if_exists(artifacts_dir / "feature_importance_gain.csv")
        _remove_if_exists(artifacts_dir / "shap_top.csv")

        # Anomaly-only fallback thresholds
        metrics = {
            "mode": "anomaly_only",
            "investigate_threshold": float(np.percentile(df["anomaly_score"], 99.5)),
            "watchlist_threshold": float(np.percentile(df["anomaly_score"], 99.0)),
            "threshold_signal": "anomaly_score",
            "n_events": int(len(df)),
        }
        save_meta(metrics, artifacts_dir)
        print("Anomaly-only mode: no supervised model.")
        print("Investigate threshold (99.5th pctl anomaly): %s" % metrics["investigate_threshold"])
        print("Watchlist threshold (99th pctl anomaly): %s" % metrics["watchlist_threshold"])
        _append_precision_tuning_log(metrics)

    # Optional: Polysights model (separate score table)
    raw_dir = artifacts_dir.parent.parent / "data" / "raw"
    polysights_path = raw_dir / "polysights.parquet"
    if polysights_path.exists():
        try:
            from ml_insider.modeling.polysights_model import fit_polysights_model, save_polysights_artifacts
            ps_df = pd.read_parquet(polysights_path)
            if len(ps_df) >= 10 and "feature" in ps_df.columns:
                ps_model, ps_imputer = fit_polysights_model(ps_df)
                save_polysights_artifacts(ps_model, ps_imputer, artifacts_dir)
                print("Polysights model trained and saved (%d rows)." % len(ps_df))
            else:
                log.info("Polysights data too small or missing 'feature'; skipping Polysights model.")
        except Exception as e:
            log.warning("Polysights model training failed: %s", e)
