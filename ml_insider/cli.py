"""
CLI: ingest, build, train, score, run-all.
"""
from __future__ import annotations

import logging
import sys
import warnings
from pathlib import Path

# Suppress urllib3 OpenSSL warning on macOS when Python is linked to LibreSSL
# (message filter only, so we don't import urllib3 here and trigger the warning)
warnings.filterwarnings("ignore", message=".*OpenSSL.*LibreSSL.*")

# Show progress (e.g. "Fetched N markets") in the terminal
logging.basicConfig(level=logging.INFO, format="%(message)s")

# Project root (parent of ml_insider)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts" / "latest"
REPORTS_DIR = PROJECT_ROOT / "reports"


def cmd_ingest() -> None:
    from ml_insider.ingest.run_ingest import run_ingest
    run_ingest(RAW_DIR)
    print("Ingest done.")


def cmd_build(labels_path: Path | None = None) -> None:
    from ml_insider.build.make_events import run_build
    run_build(RAW_DIR, PROCESSED_DIR, labels_path=labels_path)
    print("Build done.")


def cmd_train() -> None:
    from ml_insider.modeling.train import run_train
    run_train(PROCESSED_DIR, ARTIFACTS_DIR)
    print("Train done.")


def cmd_score() -> None:
    from ml_insider.modeling.score import run_score
    run_score(PROCESSED_DIR, ARTIFACTS_DIR, REPORTS_DIR)
    print("Score done.")


def cmd_report() -> None:
    from ml_insider.modeling.report import run_report
    run_report(ARTIFACTS_DIR, REPORTS_DIR)
    print("Report done.")


def cmd_run_all(labels_path: Path | None = None) -> None:
    try:
        cmd_ingest()
    except Exception as e:
        print("ingest failed: %s" % e, file=sys.stderr)
        print("(Later steps and report CSVs depend on ingest; fix the error above and re-run.)", file=sys.stderr)
        sys.exit(1)
    try:
        cmd_build(labels_path=labels_path)
    except Exception as e:
        print("build failed: %s" % e, file=sys.stderr)
        print("(CSVs will not be updated until build and later steps succeed.)", file=sys.stderr)
        sys.exit(1)
    try:
        cmd_train()
    except Exception as e:
        print("train failed: %s" % e, file=sys.stderr)
        print("(CSVs will not be updated until train and score succeed.)", file=sys.stderr)
        sys.exit(1)
    try:
        cmd_score()
    except Exception as e:
        print("score failed: %s" % e, file=sys.stderr)
        print("(Report CSVs are written by the score step; fix the error above and re-run score or run-all.)", file=sys.stderr)
        sys.exit(1)
    print("")
    print("========== RUN-ALL COMPLETE ==========")
    reports_abs = REPORTS_DIR.resolve()
    print("Reports directory: %s" % reports_abs)
    print("  suspicious_24h.csv, suspicious_7d.csv, suspicious_30d.csv, suspicious_all.csv")
    print("======================================")


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="ml_insider: insider-trading detection pipeline")
    parser.add_argument("command", choices=["ingest", "build", "train", "score", "report", "run-all"])
    parser.add_argument("--labels-path", type=Path, default=None, help="CSV with market_id, ts, flagged (for build)")
    args = parser.parse_args()
    if args.command == "ingest":
        cmd_ingest()
    elif args.command == "build":
        cmd_build(labels_path=args.labels_path)
    elif args.command == "train":
        cmd_train()
    elif args.command == "score":
        cmd_score()
    elif args.command == "report":
        cmd_report()
    elif args.command == "run-all":
        cmd_run_all(labels_path=args.labels_path)
    else:
        parser.error("unknown command")


if __name__ == "__main__":
    main()
