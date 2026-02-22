"""
LightGBM supervised PU-style model.
No wallet-specific features; only structural + anomaly_score.
Sample weight: flagged=1 -> 12.0, flagged=0 -> 1.0.
Time-based split: 80% earliest train, last 20% test; from train, last 20% validation.
Sigmoid calibration via CalibratedClassifierCV. Output probability = p_informed.
"""
from __future__ import annotations

import os
import pickle
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.impute import SimpleImputer

from ml_insider.modeling.anomaly import STRUCTURAL_FEATURES

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("KMP_AFFINITY", "disabled")
os.environ.setdefault("KMP_SETTINGS", "0")
os.environ.setdefault("KMP_USE_SHM", "0")

_LIGHTGBM_SAFE: bool | None = None

EXTRA_STRUCTURAL_FEATURES = [
    "size_percentile_market",
    "impact_percentile_market",
    "timing_percentile_market",
    "trade_count_5m_z",
    "trade_count_15m_z",
]
USE_EXTRA_STRUCTURAL_FEATURES = os.getenv("ML_INSIDER_USE_EXTRA_STRUCTURAL_FEATURES", "0").strip().lower() in (
    "1",
    "true",
    "yes",
)
if USE_EXTRA_STRUCTURAL_FEATURES:
    SUPERVISED_FEATURES = STRUCTURAL_FEATURES + ["anomaly_score"] + EXTRA_STRUCTURAL_FEATURES
else:
    SUPERVISED_FEATURES = STRUCTURAL_FEATURES + ["anomaly_score"]
CALIBRATION_METHOD = os.getenv("ML_INSIDER_CALIBRATION_METHOD", "isotonic").strip().lower() or "isotonic"


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name, str(default)).strip()
    try:
        return float(raw)
    except ValueError:
        return default


LGBM_N_ESTIMATORS = _env_int("ML_INSIDER_LGBM_N_ESTIMATORS", 400)
LGBM_LEARNING_RATE = _env_float("ML_INSIDER_LGBM_LEARNING_RATE", 0.05)
LGBM_MAX_DEPTH = _env_int("ML_INSIDER_LGBM_MAX_DEPTH", 6)
LGBM_NUM_LEAVES = _env_int("ML_INSIDER_LGBM_NUM_LEAVES", 31)
LGBM_MIN_DATA_IN_LEAF = _env_int("ML_INSIDER_LGBM_MIN_DATA_IN_LEAF", 40)
LGBM_REG_LAMBDA = _env_float("ML_INSIDER_LGBM_REG_LAMBDA", 0.0)
LGBM_REG_ALPHA = _env_float("ML_INSIDER_LGBM_REG_ALPHA", 0.0)
LGBM_MIN_GAIN_TO_SPLIT = _env_float("ML_INSIDER_LGBM_MIN_GAIN_TO_SPLIT", 0.0)


def _rank_pct_within_group(values: pd.Series) -> pd.Series:
    # Percentile rank normalized to [0, 1] inside each group.
    return values.rank(method="average", pct=True).fillna(0.5)


def _compute_grouped_rolling_counts(df: pd.DataFrame, window: str) -> pd.Series:
    out = pd.Series(index=df.index, dtype=float)
    for _, grp in df.groupby(["platform", "market_id"], sort=False):
        grp = grp.sort_values("ts")
        ts = pd.to_datetime(grp["ts"], errors="coerce")
        series = pd.Series(np.ones(len(grp), dtype=float), index=ts)
        counts = series.rolling(window).sum().fillna(0.0).values
        out.loc[grp.index] = counts
    return out.fillna(0.0)


def build_supervised_feature_frame(df: pd.DataFrame) -> pd.DataFrame:
    if not USE_EXTRA_STRUCTURAL_FEATURES:
        return df[SUPERVISED_FEATURES]

    out = df.copy()
    out["ts"] = pd.to_datetime(out["ts"], errors="coerce")

    gcols = ["platform", "market_id"]
    out["size_percentile_market"] = out.groupby(gcols)["trade_size"].transform(_rank_pct_within_group)
    out["impact_percentile_market"] = out.groupby(gcols)["liquidity_impact"].transform(_rank_pct_within_group)
    # Lower time_to_resolution is riskier, so rank negative hours.
    out["timing_percentile_market"] = (
        out.groupby(gcols)["time_to_resolution_hours"].transform(lambda s: _rank_pct_within_group(-s))
    )

    c5 = _compute_grouped_rolling_counts(out, "5min")
    c15 = _compute_grouped_rolling_counts(out, "15min")
    c5_mean = c5.groupby([out["platform"], out["market_id"]]).transform("mean")
    c5_std = c5.groupby([out["platform"], out["market_id"]]).transform("std").replace(0, np.nan)
    c15_mean = c15.groupby([out["platform"], out["market_id"]]).transform("mean")
    c15_std = c15.groupby([out["platform"], out["market_id"]]).transform("std").replace(0, np.nan)
    out["trade_count_5m_z"] = ((c5 - c5_mean) / c5_std).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    out["trade_count_15m_z"] = ((c15 - c15_mean) / c15_std).replace([np.inf, -np.inf], np.nan).fillna(0.0)

    return out[SUPERVISED_FEATURES]


def _lightgbm_is_safe() -> bool:
    global _LIGHTGBM_SAFE
    if _LIGHTGBM_SAFE is not None:
        return _LIGHTGBM_SAFE
    if os.environ.get("ML_INSIDER_SKIP_LIGHTGBM", "").strip() in ("1", "true", "yes"):
        _LIGHTGBM_SAFE = False
        return _LIGHTGBM_SAFE
    check_code = (
        "import lightgbm\n"
    )
    env = os.environ.copy()
    env.setdefault("OMP_NUM_THREADS", "1")
    env.setdefault("KMP_AFFINITY", "disabled")
    env.setdefault("KMP_SETTINGS", "0")
    env.setdefault("KMP_USE_SHM", "0")
    try:
        result = subprocess.run(
            [sys.executable, "-c", check_code],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=env,
            timeout=15,
            check=False,
        )
        _LIGHTGBM_SAFE = result.returncode == 0
    except Exception:
        _LIGHTGBM_SAFE = False
    return _LIGHTGBM_SAFE


def _build_base_estimator():
    if _lightgbm_is_safe():
        import lightgbm as lgb

        return lgb.LGBMClassifier(
            n_estimators=LGBM_N_ESTIMATORS,
            learning_rate=LGBM_LEARNING_RATE,
            max_depth=LGBM_MAX_DEPTH,
            num_leaves=LGBM_NUM_LEAVES,
            min_data_in_leaf=LGBM_MIN_DATA_IN_LEAF,
            min_gain_to_split=LGBM_MIN_GAIN_TO_SPLIT,
            reg_lambda=LGBM_REG_LAMBDA,
            reg_alpha=LGBM_REG_ALPHA,
            n_jobs=1,
            num_threads=1,
            random_state=42,
            verbosity=-1,
        ), "lightgbm"
    from sklearn.ensemble import GradientBoostingClassifier

    return GradientBoostingClassifier(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=3,
        random_state=42,
    ), "gradient_boosting_fallback"


def _train_test_split_time(df: pd.DataFrame, test_frac: float = 0.2) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split by time: earliest (1-test_frac) train and latest test_frac, per platform when available."""
    if "platform" in df.columns:
        train_parts = []
        test_parts = []
        for _, grp in df.groupby("platform", sort=False):
            grp = grp.sort_values("ts").reset_index(drop=True)
            n = len(grp)
            cut = int(n * (1 - test_frac))
            train_parts.append(grp.iloc[:cut])
            test_parts.append(grp.iloc[cut:])
        train_df = pd.concat(train_parts, ignore_index=True).sort_values("ts").reset_index(drop=True)
        test_df = pd.concat(test_parts, ignore_index=True).sort_values("ts").reset_index(drop=True)
        return train_df, test_df
    df = df.sort_values("ts").reset_index(drop=True)
    n = len(df)
    cut = int(n * (1 - test_frac))
    return df.iloc[:cut], df.iloc[cut:]


def _train_val_split_time(train_df: pd.DataFrame, val_frac: float = 0.2) -> tuple[pd.DataFrame, pd.DataFrame]:
    """From the training set, split by time into earliest train and latest validation, per platform when available."""
    if "platform" in train_df.columns:
        train_parts = []
        val_parts = []
        for _, grp in train_df.groupby("platform", sort=False):
            grp = grp.sort_values("ts").reset_index(drop=True)
            n = len(grp)
            cut = int(n * (1 - val_frac))
            train_parts.append(grp.iloc[:cut])
            val_parts.append(grp.iloc[cut:])
        tr_df = pd.concat(train_parts, ignore_index=True).sort_values("ts").reset_index(drop=True)
        val_df = pd.concat(val_parts, ignore_index=True).sort_values("ts").reset_index(drop=True)
        return tr_df, val_df
    train_df = train_df.sort_values("ts").reset_index(drop=True)
    n = len(train_df)
    cut = int(n * (1 - val_frac))
    return train_df.iloc[:cut], train_df.iloc[cut:]


def get_sample_weights(flagged: np.ndarray, weight_positive: float = 12.0) -> np.ndarray:
    """flagged=1 -> weight_positive, flagged=0 -> 1.0"""
    w = np.ones(len(flagged), dtype=float)
    w[flagged == 1] = weight_positive
    return w


def fit_supervised(
    df: pd.DataFrame,
    train_frac: float = 0.8,
    val_frac_of_train: float = 0.2,
    weight_positive: float = 12.0,
    label_col: str = "flagged",
) -> tuple[CalibratedClassifierCV, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Time split -> train/val/test. Fit LightGBM + sigmoid calibration on train.
    label_col: "flagged" or "pseudo_flagged". Returns (calibrated model, train_df, val_df, test_df).
    """
    required_raw = [
        "ts",
        "platform",
        "market_id",
        "trade_size",
        "liquidity_impact",
        "time_to_resolution_hours",
    ] + STRUCTURAL_FEATURES + ["anomaly_score", label_col]
    for c in required_raw:
        if c not in df.columns:
            raise ValueError("Supervised feature or '%s' missing: %s. Columns: %s" % (label_col, c, list(df.columns)))
    train_df, test_df = _train_test_split_time(df, test_frac=1 - train_frac)
    train_df, val_df = _train_val_split_time(train_df, val_frac=val_frac_of_train)

    X_train = build_supervised_feature_frame(train_df)
    y_train = train_df[label_col].astype(int).values
    w_train = get_sample_weights(y_train, weight_positive=weight_positive)
    X_val = build_supervised_feature_frame(val_df)
    y_val = val_df[label_col].astype(int).values

    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)
    X_val_imp = imputer.transform(X_val)

    base, base_name = _build_base_estimator()
    base.fit(X_train_imp, y_train, sample_weight=w_train)
    method = CALIBRATION_METHOD if CALIBRATION_METHOD in ("sigmoid", "isotonic") else "sigmoid"
    calibrated = CalibratedClassifierCV(base, method=method, cv="prefit")
    calibrated.fit(X_val_imp, y_val)
    calibrated.ml_insider_base_model = base_name
    calibrated.ml_insider_imputer = imputer
    calibrated.ml_insider_calibration_method = method
    return calibrated, train_df, val_df, test_df


def predict_p_informed(model: CalibratedClassifierCV, df: pd.DataFrame) -> np.ndarray:
    """Predict probability of positive class (p_informed)."""
    X = build_supervised_feature_frame(df)
    imputer = getattr(model, "ml_insider_imputer", None)
    if imputer is not None:
        X = imputer.transform(X)
    return model.predict_proba(X)[:, 1]


def save_supervised_artifacts(model: CalibratedClassifierCV, out_dir: Path) -> None:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "supervised_model.pkl", "wb") as f:
        pickle.dump(model, f)


def load_supervised_artifacts(out_dir: Path) -> CalibratedClassifierCV:
    out_dir = Path(out_dir)
    with open(out_dir / "supervised_model.pkl", "rb") as f:
        return pickle.load(f)
