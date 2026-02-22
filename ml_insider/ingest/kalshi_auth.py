"""
Kalshi request signing: RSA-PSS with SHA256.
Message = timestamp + method + path (path without query params).
Headers: KALSHI-ACCESS-KEY, KALSHI-ACCESS-TIMESTAMP, KALSHI-ACCESS-SIGNATURE.
"""
import base64
import time

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding


def sign_request(private_key, timestamp: str, method: str, path: str) -> str:
    """Create base64-encoded RSA-PSS signature. Path must not include query string."""
    path_no_query = path.split("?")[0]
    message = ("%s%s%s" % (timestamp, method.upper(), path_no_query)).encode("utf-8")
    signature = private_key.sign(
        message,
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.DIGEST_LENGTH,
        ),
        hashes.SHA256(),
    )
    return base64.b64encode(signature).decode("utf-8")


def kalshi_headers(private_key, access_key: str, method: str, path: str) -> dict:
    """Build KALSHI-ACCESS-* headers for one request."""
    timestamp = str(int(time.time() * 1000))
    sig = sign_request(private_key, timestamp, method, path)
    return {
        "KALSHI-ACCESS-KEY": access_key,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
        "KALSHI-ACCESS-SIGNATURE": sig,
    }
