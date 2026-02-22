"""
Validation metrics: PR-AUC, Brier, Precision@50, Precision@200,
Recall@80% precision, Recall@90% precision.
Threshold selection: Investigate = lowest threshold with >= 80% precision;
Watchlist = lowest threshold with >= 90% recall.
"""
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import average_precision_score, brier_score_loss


def pr_auc_from_curve(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """Average precision (PR-AUC)."""
    if len(y_true) == 0:
        return 0.0
    return float(average_precision_score(y_true, y_prob))


def precision_at_k(y_true: np.ndarray, y_prob: np.ndarray, k: int) -> float:
    """Precision when taking top k by predicted probability."""
    if len(y_true) == 0 or k <= 0:
        return 0.0
    order = np.argsort(-y_prob)
    top_k = order[: min(k, len(order))]
    return float(np.mean(y_true[top_k]))


def _threshold_precision_recall(y_true: np.ndarray, y_prob: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Return per-threshold precision and recall for score >= threshold.
    Thresholds are unique score values in ascending order.
    """
    if len(y_true) == 0:
        return np.array([], dtype=float), np.array([], dtype=float), np.array([], dtype=float)
    y_true = np.asarray(y_true).astype(int)
    y_prob = np.asarray(y_prob).astype(float)
    order = np.argsort(y_prob, kind="mergesort")
    y_prob_sorted = y_prob[order]
    y_true_sorted = y_true[order]
    thresholds, first_idx = np.unique(y_prob_sorted, return_index=True)
    tp_from_end = np.cumsum(y_true_sorted[::-1])[::-1]
    fp_from_end = np.cumsum((1 - y_true_sorted)[::-1])[::-1]
    tp = tp_from_end[first_idx]
    fp = fp_from_end[first_idx]
    precisions = tp / np.maximum(tp + fp, 1)
    n_pos = int(y_true.sum())
    recalls = tp / n_pos if n_pos > 0 else np.zeros(len(tp), dtype=float)
    return thresholds, precisions.astype(float), recalls.astype(float)


def recall_at_precision(y_true: np.ndarray, y_prob: np.ndarray, min_precision: float) -> float:
    """Maximum recall achievable with precision >= min_precision."""
    _, prec, rec = _threshold_precision_recall(y_true, y_prob)
    ok = prec >= min_precision
    if not np.any(ok):
        return 0.0
    return float(np.max(rec[ok]))


def threshold_for_min_precision(y_true: np.ndarray, y_prob: np.ndarray, min_precision: float) -> float:
    """Lowest (smallest) threshold achieving >= min_precision."""
    thresholds, prec, _ = _threshold_precision_recall(y_true, y_prob)
    for i, threshold in enumerate(thresholds):
        if prec[i] >= min_precision:
            return float(threshold)
    return 0.0


def threshold_for_min_recall(y_true: np.ndarray, y_prob: np.ndarray, min_recall: float) -> float:
    """Lowest (smallest) threshold achieving >= min_recall."""
    thresholds, _, rec = _threshold_precision_recall(y_true, y_prob)
    for i, threshold in enumerate(thresholds):
        if rec[i] >= min_recall:
            return float(threshold)
    return 0.0


def compute_validation_metrics(
    y_true: np.ndarray,
    y_prob: np.ndarray,
) -> dict:
    """Return dict with PR-AUC, Brier, Precision@50, Precision@200, Recall@80% prec, Recall@90% prec."""
    if len(y_true) == 0:
        return {
            "pr_auc": 0.0,
            "brier": 0.0,
            "precision_at_50": 0.0,
            "precision_at_200": 0.0,
            "recall_at_80_precision": 0.0,
            "recall_at_90_precision": 0.0,
        }
    return {
        "pr_auc": pr_auc_from_curve(y_true, y_prob),
        "brier": float(brier_score_loss(y_true, y_prob)),
        "precision_at_50": precision_at_k(y_true, y_prob, 50),
        "precision_at_200": precision_at_k(y_true, y_prob, 200),
        "recall_at_80_precision": recall_at_precision(y_true, y_prob, 0.80),
        "recall_at_90_precision": recall_at_precision(y_true, y_prob, 0.90),
    }


def select_thresholds(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    investigate_min_precision: float = 0.80,
    watchlist_min_recall: float = 0.90,
) -> tuple[float, float]:
    """
    Investigate threshold = lowest threshold with precision >= investigate_min_precision.
    Watchlist threshold = lowest threshold with recall >= watchlist_min_recall.
    Returns (investigate_threshold, watchlist_threshold).
    """
    inv_thresh = threshold_for_min_precision(y_true, y_prob, investigate_min_precision)
    watch_thresh = threshold_for_min_recall(y_true, y_prob, watchlist_min_recall)
    return inv_thresh, watch_thresh


def save_meta(
    meta: dict,
    out_dir: Path,
) -> None:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "meta.json", "w") as f:
        json.dump(meta, f, indent=2)


def load_meta(out_dir: Path) -> dict:
    with open(Path(out_dir) / "meta.json") as f:
        return json.load(f)
