"""Tests for CLI: module loads and run-all is available."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Ensure project root is on path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def test_cli_module_imports() -> None:
    from ml_insider import cli
    assert hasattr(cli, "cmd_run_all")
    assert hasattr(cli, "cmd_ingest")
    assert hasattr(cli, "cmd_build")
    assert hasattr(cli, "cmd_train")
    assert hasattr(cli, "cmd_score")
    assert hasattr(cli, "cmd_report")


def test_cli_main_accepts_run_all() -> None:
    from ml_insider.cli import main
    # Just check it's callable; we don't run it (needs network / time)
    assert callable(main)
