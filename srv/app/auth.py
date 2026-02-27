import logging
import os

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException
from jose import JWTError, jwt

load_dotenv()

logger = logging.getLogger(__name__)

_SUPABASE_URL: str = os.environ.get("APP_SUPABASE_URL", "")
_JWT_SECRET: str = os.environ.get("SUPABASE_JWT_SECRET", "")
_JWKS_CACHE: dict | None = None


def _get_jwks() -> dict:
    global _JWKS_CACHE
    if _JWKS_CACHE is None:
        url = f"{_SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        _JWKS_CACHE = resp.json()
        logger.info("Fetched JWKS from %s (%d key(s))", url, len(_JWKS_CACHE.get("keys", [])))
    return _JWKS_CACHE


def verify_supabase_jwt(token: str) -> dict:
    """Verify a Supabase auth JWT.

    Tries HS256 with SUPABASE_JWT_SECRET first (fast path, always used in tests).
    Falls back to JWKS-based verification (ES256/RS256) for newer Supabase projects.
    """
    last_error: Exception | None = None

    if _JWT_SECRET:
        try:
            return jwt.decode(
                token, _JWT_SECRET, algorithms=["HS256"], audience="authenticated"
            )
        except JWTError as e:
            last_error = e

    if _SUPABASE_URL:
        try:
            jwks = _get_jwks()
            return jwt.decode(
                token, jwks, algorithms=["ES256", "RS256"], audience="authenticated"
            )
        except JWTError as e:
            last_error = e
        except httpx.HTTPError as e:
            logger.warning("Failed to fetch JWKS: %s", e)

    detail = str(last_error) if last_error else "No JWT verification method configured"
    raise HTTPException(status_code=401, detail=detail)
