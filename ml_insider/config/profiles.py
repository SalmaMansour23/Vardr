"""Profile loader and env application for pipeline tuning presets."""
from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PROFILES_DIR = PROJECT_ROOT / "configs" / "profiles"


def _parse_scalar(value: str) -> str:
    raw = value.strip()
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        return raw[1:-1]
    return raw


def _parse_simple_yaml_mapping(text: str) -> dict[str, object]:
    """
    Parse a very small YAML subset:
    - top-level key: value
    - top-level key: followed by one indented mapping block
    This is enough for configs/profiles/*.yaml used by this project.
    """
    result: dict[str, object] = {}
    current_map_key: str | None = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue

        indent = len(line) - len(line.lstrip(" "))
        body = line.strip()
        if ":" not in body:
            continue
        key, value = body.split(":", 1)
        key = key.strip()
        value = value.strip()

        if indent == 0:
            current_map_key = None
            if value == "":
                result[key] = {}
                current_map_key = key
            else:
                result[key] = _parse_scalar(value)
            continue

        if current_map_key is None:
            continue
        nested = result.get(current_map_key)
        if not isinstance(nested, dict):
            nested = {}
            result[current_map_key] = nested
        nested[key] = _parse_scalar(value)

    return result


def load_profile_env(profile_name: str, profiles_dir: Path | None = None) -> tuple[Path, dict[str, str]]:
    profiles_dir = profiles_dir or PROFILES_DIR
    path = Path(profiles_dir) / f"{profile_name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Profile not found: {path}")
    parsed = _parse_simple_yaml_mapping(path.read_text(encoding="utf-8"))
    env_map_raw = parsed.get("env")
    if not isinstance(env_map_raw, dict):
        raise ValueError(f"Profile {path} must contain an 'env' mapping.")
    env_map: dict[str, str] = {}
    for k, v in env_map_raw.items():
        env_map[str(k)] = str(v)
    return path, env_map


def apply_profile(profile_name: str | None) -> dict[str, object]:
    """
    Apply profile values into process env only when variable is not already set.
    User-provided env vars remain the highest-priority override.
    """
    if not profile_name:
        os.environ.pop("ML_INSIDER_ACTIVE_PROFILE", None)
        os.environ.pop("ML_INSIDER_ACTIVE_PROFILE_PATH", None)
        return {"active_profile": None, "applied_env": {}, "profile_env": {}}

    path, profile_env = load_profile_env(profile_name)
    applied_env: dict[str, str] = {}
    for key, value in profile_env.items():
        if key in os.environ:
            continue
        os.environ[key] = value
        applied_env[key] = value

    os.environ["ML_INSIDER_ACTIVE_PROFILE"] = profile_name
    os.environ["ML_INSIDER_ACTIVE_PROFILE_PATH"] = str(path)
    return {
        "active_profile": profile_name,
        "profile_path": str(path),
        "applied_env": applied_env,
        "profile_env": profile_env,
    }
