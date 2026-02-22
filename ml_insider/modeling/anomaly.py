"""
IsolationForest anomaly model.
Uses only structural features: z_score_trade_size, liquidity_impact, time_to_resolution_hours,
price_distance_from_50, trade_size_log.
SimpleImputer(median), contamination=0.01, normalize anomaly score to 0-1.
"""
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import MinMaxScaler

STRUCTURAL_FEATURES = [
    "z_score_trade_size",
    "liquidity_impact",
    "time_to_resolution_hours",
    "price_distance_from_50",
    "trade_size_log",
]


def get_structural_matrix(df: pd.DataFrame) -> tuple[np.ndarray, SimpleImputer]:
    """Extract structural feature matrix; impute missing with median. Returns (X_imp, fitted imputer)."""
    X = df[STRUCTURAL_FEATURES].copy()
    for c in STRUCTURAL_FEATURES:
        if c not in X.columns:
            raise ValueError("Structural feature missing: %s. Available: %s" % (c, list(df.columns)))
    imputer = SimpleImputer(strategy="median")
    X_imp = imputer.fit_transform(X)
    return X_imp, imputer


def fit_isolation_forest(
    df: pd.DataFrame,
    contamination: float = 0.01,
) -> tuple[IsolationForest, SimpleImputer, MinMaxScaler]:
    """Fit IsolationForest on structural features; return model, imputer, and scaler for 0-1 score."""
    X, imputer = get_structural_matrix(df)
    clf = IsolationForest(contamination=contamination, random_state=42)
    clf.fit(X)
    raw_scores = clf.decision_function(X)
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaler.fit(-raw_scores.reshape(-1, 1))
    return clf, imputer, scaler


def get_structural_matrix_with_imputer(df: pd.DataFrame, imputer: SimpleImputer) -> np.ndarray:
    """Use pre-fitted imputer."""
    X = df[STRUCTURAL_FEATURES].copy()
    for c in STRUCTURAL_FEATURES:
        if c not in X.columns:
            raise ValueError("Structural feature missing: %s" % c)
    return imputer.transform(X)


def predict_anomaly_score(
    df: pd.DataFrame,
    clf: IsolationForest,
    imputer: SimpleImputer,
    scaler: MinMaxScaler,
) -> np.ndarray:
    """Return 0-1 anomaly score (higher = more anomalous)."""
    X = get_structural_matrix_with_imputer(df, imputer)
    raw = clf.decision_function(X)
    score_01 = scaler.transform(-raw.reshape(-1, 1)).ravel()
    return np.clip(score_01, 0.0, 1.0)


def save_anomaly_artifacts(
    clf: IsolationForest,
    imputer: SimpleImputer,
    scaler: MinMaxScaler,
    out_dir: Path,
) -> None:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "anomaly_model.pkl", "wb") as f:
        pickle.dump({"clf": clf, "imputer": imputer, "scaler": scaler}, f)
    with open(out_dir / "anomaly_isolation_forest.pkl", "wb") as f:
        pickle.dump(clf, f)
    with open(out_dir / "anomaly_imputer.pkl", "wb") as f:
        pickle.dump(imputer, f)
    with open(out_dir / "anomaly_scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)


def load_anomaly_artifacts(out_dir: Path) -> tuple[IsolationForest, SimpleImputer, MinMaxScaler]:
    out_dir = Path(out_dir)
    clf_path = out_dir / "anomaly_isolation_forest.pkl"
    imputer_path = out_dir / "anomaly_imputer.pkl"
    scaler_path = out_dir / "anomaly_scaler.pkl"
    if clf_path.exists() and imputer_path.exists() and scaler_path.exists():
        with open(clf_path, "rb") as f:
            clf = pickle.load(f)
        with open(imputer_path, "rb") as f:
            imputer = pickle.load(f)
        with open(scaler_path, "rb") as f:
            scaler = pickle.load(f)
        return clf, imputer, scaler
    with open(out_dir / "anomaly_model.pkl", "rb") as f:
        d = pickle.load(f)
    return d["clf"], d["imputer"], d["scaler"]
