"""
Feature importance (gain) and SHAP (if installed).
Save feature_importance_gain.csv and optionally shap_top.csv (mean absolute SHAP).
If SHAP fails, continue gracefully.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ml_insider.modeling.supervised import SUPERVISED_FEATURES


def _get_base_estimator(model):
    if hasattr(model, "calibrated_classifiers_") and model.calibrated_classifiers_:
        cal = model.calibrated_classifiers_[0]
        if hasattr(cal, "estimator"):
            return cal.estimator
        if hasattr(cal, "base_estimator"):
            return cal.base_estimator
    if hasattr(model, "base_estimator"):
        return model.base_estimator
    return model


def get_lgb_feature_importance_gain(model) -> pd.DataFrame:
    """Extract gain importance from LightGBM booster (importance_type='gain')."""
    base = _get_base_estimator(model)
    try:
        booster = base.booster_
        gain = booster.feature_importance(importance_type="gain")
        names = booster.feature_name()
    except AttributeError:
        # fallback if booster_ not available
        gain = base.feature_importances_
        names = SUPERVISED_FEATURES
    return pd.DataFrame({"feature": names, "importance_gain": gain}).sort_values("importance_gain", ascending=False)


def save_feature_importance_gain(model, out_dir: Path) -> Path:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    df = get_lgb_feature_importance_gain(model)
    path = out_dir / "feature_importance_gain.csv"
    df.to_csv(path, index=False)
    return path


def compute_shap_top(model, X: pd.DataFrame, out_dir: Path, top_n: int = 20) -> Path | None:
    """
    Compute mean absolute SHAP; save top features to artifacts/latest/shap_top.csv.
    Returns path if successful, None if SHAP not installed or fails.
    """
    try:
        import shap
    except ImportError:
        return None
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        base = _get_base_estimator(model)
        explainer = shap.TreeExplainer(base)
        shap_vals = explainer.shap_values(X)
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[1]
        mean_abs = np.abs(shap_vals).mean(axis=0)
        df = pd.DataFrame({"feature": X.columns.tolist(), "mean_abs_shap": mean_abs})
        df = df.sort_values("mean_abs_shap", ascending=False).head(top_n)
        path = out_dir / "shap_top.csv"
        df.to_csv(path, index=False)
        return path
    except Exception:
        return None
