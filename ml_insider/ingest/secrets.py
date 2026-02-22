"""
Secure credential loading for Kalshi (key + signature auth).
Kalshi uses API Key ID + RSA private key; NOT Bearer tokens.
- KALSHI_ACCESS_KEY: API Key ID (env or ~/Documents/kalshi_access_key.txt)
- KALSHI_PRIVATE_KEY_PATH: path to .key PEM file (env or ~/Documents/kalshi.key)
If private key path is missing, raise and ask user for it.
NEVER print or log keys or key content.
"""
import os
from pathlib import Path


def _project_root() -> Path:
    """Project root (parent of ml_insider)."""
    return Path(__file__).resolve().parents[2]


def get_kalshi_access_key() -> str:
    """API Key ID (e.g. uuid). Env KALSHI_ACCESS_KEY, then .kalshi_access_key in project, then ~/Documents/kalshi_access_key.txt."""
    key = os.environ.get("KALSHI_ACCESS_KEY")
    if key is not None and key.strip() != "":
        return key.strip()
    for path in [
        _project_root() / ".kalshi_access_key",
        Path.home() / "Documents" / "kalshi_access_key.txt",
    ]:
        if path.exists():
            key = path.read_text().strip()
            if key:
                return key
    raise RuntimeError(
        "Kalshi API Key ID not found. Set KALSHI_ACCESS_KEY or create .kalshi_access_key in project or ~/Documents/kalshi_access_key.txt"
    )


def get_kalshi_private_key_path() -> Path:
    """Path to RSA private key PEM file. Required for request signing."""
    path = os.environ.get("KALSHI_PRIVATE_KEY_PATH")
    if path and path.strip():
        p = Path(path.strip()).expanduser()
        if p.exists():
            return p
        raise FileNotFoundError("KALSHI_PRIVATE_KEY_PATH points to missing file: %s" % p)
    for default in [
        _project_root() / ".kalshi.key",
        _project_root() / "apikey.txt",
        _project_root() / "APIKey.txt",
        Path.home() / "Documents" / "kalshi.key",
    ]:
        if default.exists():
            return default
    raise RuntimeError(
        "Kalshi private key not found. Set KALSHI_PRIVATE_KEY_PATH or place your .key file at .kalshi.key, apikey.txt (project), or ~/Documents/kalshi.key. "
        "Generate the key in Kalshi: Account & security → API Keys → Create Key; download the .key file."
    )


def load_kalshi_private_key():
    """Load RSA private key from path. Returns cryptography private key object."""
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import load_pem_private_key

    path = get_kalshi_private_key_path()
    data = path.read_bytes()
    return load_pem_private_key(data, password=None, backend=default_backend())
