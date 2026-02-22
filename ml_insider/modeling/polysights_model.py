"""
Supervised model trained on scraped Polysights data (Market, Spread, Price 12h %, Price 24h %, Bid Ask Spread -> Feature).
Outputs polysights_score per row. Used only for Polysights table; main events keep anomaly_score and p_informed.
"""
from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split

POLYSIGHTS_FEATURES = ["spread", "price_12h_pct", "price_24h_pct", "bid_ask_spread"]


def fit_polysights_model(df: pd.DataFrame) -> tuple[RandomForestClassifier, SimpleImputer]:
    """Train classifier to predict feature from numeric columns."""
    for c in POLYSIGHTS_FEATURES + ["feature"]:
        if c not in df.columns:
            raise ValueError("Polysights data missing column: %s" % c)
    X = df[POLYSIGHTS_FEATURES]
    y = (df["feature"] == True) | (df["feature"] == 1)
    if y.sum() < 1:
        y = (df["spread"] > df["spread"].median())  # fallback: high spread as proxy
    imputer = SimpleImputer(strategy="median")
    X_imp = imputer.fit_transform(X)
    clf = RandomForestClassifier(n_estimators=50, max_depth=5, random_state=42)
    clf.fit(X_imp, y)
    return clf, imputer


def predict_polysights_score(df: pd.DataFrame, artifacts: dict) -> np.ndarray:
    """Return probability of positive class (polysights_score) for rows that have POLYSIGHTS_FEATURES."""
    clf = artifacts["model"]
    imputer = artifacts["imputer"]
    missing = [c for c in POLYSIGHTS_FEATURES if c not in df.columns]
    if missing:
        return np.full(len(df), np.nan)
    X = imputer.transform(df[POLYSIGHTS_FEATURES])
    proba = clf.predict_proba(X)[:, 1]
    return proba


def save_polysights_artifacts(model, imputer, out_dir: Path) -> None:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "polysights_model.pkl", "wb") as f:
        pickle.dump({"model": model, "imputer": imputer}, f)


def load_polysights_artifacts(out_dir: Path) -> dict:
    with open(Path(out_dir) / "polysights_model.pkl", "rb") as f:
        return pickle.load(f)
