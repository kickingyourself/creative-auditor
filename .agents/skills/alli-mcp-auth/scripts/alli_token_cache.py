"""Cache + rotation-safe wrapper around the Alli access-token exchange.

Usage:
    from alli_token_cache import get_access_token
    t = get_access_token()                 # returns a valid bearer; refreshes if needed
    t = get_access_token(force_refresh=True)  # bypass cache

Why this exists:
- `pmg-cowork-login alli` rotates the refresh token on every exchange. Long-running
  scripts that call `get_access_token()` repeatedly hit `400 Bad Request` mid-run
  because the saved refresh token was already rotated by a prior call.
- Solution: cache the access token in a file with TTL (default 50 min, well under
  the typical 1h Alli access-token lifetime), and serialize refresh-token rotation
  via a file lock so concurrent calls don't race.

This wrapper supersedes the inline `get_access_token()` in:
  - .agents/skills/alli-list-clients/scripts/list_clients.py
  - .agents/skills/alli-unified-data-sql-query/scripts/run_query.py
  - Projects/Fanatics State Upload/scripts/_alli_helpers.py
  (callers can monkey-patch in or import directly.)

It also preferentially uses the machine `client_credentials` grant when
`ALLI_MACHINE_CLIENT_ID` + `ALLI_MACHINE_CLIENT_SECRET` are present in `.env`,
falling back to the user `refresh_token` grant otherwise. The machine path
doesn't rotate, so the lock is a no-op for that branch.
"""
from __future__ import annotations

import fcntl
import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv, set_key

WORKSPACE_ROOT = Path("/Users/maxwellthomason/PMG - Workspace")
DOTENV_PATH = WORKSPACE_ROOT / ".env"
CACHE_DIR = Path.home() / ".cache" / "alli-token"
CACHE_PATH = CACHE_DIR / "access_token.json"
LOCK_PATH = CACHE_DIR / ".lock"
TOKEN_URL = "https://login.alliplatform.com/token"

# Refresh ~10 min before token expiry to avoid edge-case 401s mid-call.
DEFAULT_TTL_SECONDS = 50 * 60
SAFETY_BUFFER_SECONDS = 60


def _ensure_cache_dir() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _read_cache() -> dict | None:
    if not CACHE_PATH.exists():
        return None
    try:
        return json.loads(CACHE_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return None


def _write_cache(token: str, expires_at: float, source: str) -> None:
    _ensure_cache_dir()
    CACHE_PATH.write_text(json.dumps({
        "access_token": token,
        "expires_at": expires_at,
        "source": source,
    }))


def _cache_is_fresh(now: float) -> str | None:
    cached = _read_cache()
    if not cached:
        return None
    if cached.get("expires_at", 0) - SAFETY_BUFFER_SECONDS <= now:
        return None
    return cached.get("access_token")


def _exchange_machine() -> tuple[str, int] | None:
    """If ALLI_MACHINE_CLIENT_ID + ALLI_MACHINE_CLIENT_SECRET are set, use
    client_credentials grant (preferred — no refresh-token rotation).
    Returns (access_token, expires_in_seconds) or None if creds aren't set."""
    cid = os.environ.get("ALLI_MACHINE_CLIENT_ID")
    secret = os.environ.get("ALLI_MACHINE_CLIENT_SECRET")
    if not (cid and secret):
        return None
    r = requests.post(
        TOKEN_URL,
        data={"grant_type": "client_credentials", "client_id": cid, "client_secret": secret},
        timeout=30,
    )
    r.raise_for_status()
    body = r.json()
    return body["access_token"], int(body.get("expires_in", 3600))


def _exchange_user() -> tuple[str, int]:
    """User-scoped refresh-token grant. Persists rotated refresh_token back to .env."""
    refresh = os.environ["ALLI_REFRESH_TOKEN"]
    cid = os.environ["ALLI_CLIENT_ID"]
    r = requests.post(
        TOKEN_URL,
        data={"grant_type": "refresh_token", "refresh_token": refresh, "client_id": cid},
        timeout=30,
    )
    r.raise_for_status()
    body = r.json()
    new_refresh = body.get("refresh_token")
    if new_refresh and new_refresh != refresh:
        set_key(str(DOTENV_PATH), "ALLI_REFRESH_TOKEN", new_refresh)
    return body["access_token"], int(body.get("expires_in", 3600))


def get_access_token(force_refresh: bool = False) -> str:
    """Return a valid Alli access token. Caches with TTL; serializes rotation
    via file lock so concurrent callers don't race the refresh-token grant.
    """
    # override=True so a stale shell-exported ALLI_REFRESH_TOKEN doesn't shadow
    # the fresh one persisted to .env by `pmg-cowork-login alli` or by the
    # rotation in `_exchange_user`.
    load_dotenv(DOTENV_PATH, override=True)
    now = time.time()

    if not force_refresh:
        cached = _cache_is_fresh(now)
        if cached:
            return cached

    _ensure_cache_dir()
    with open(LOCK_PATH, "w") as lock_fp:
        fcntl.flock(lock_fp.fileno(), fcntl.LOCK_EX)
        try:
            # Re-check inside lock — another process may have just refreshed.
            if not force_refresh:
                cached = _cache_is_fresh(time.time())
                if cached:
                    return cached

            machine = _exchange_machine()
            if machine:
                token, expires_in = machine
                source = "machine"
            else:
                token, expires_in = _exchange_user()
                source = "user"

            ttl = min(expires_in, DEFAULT_TTL_SECONDS)
            _write_cache(token, time.time() + ttl, source)
            return token
        finally:
            fcntl.flock(lock_fp.fileno(), fcntl.LOCK_UN)


def invalidate() -> None:
    """Drop the cached token. Call from 401-handlers."""
    try:
        CACHE_PATH.unlink()
    except FileNotFoundError:
        pass


if __name__ == "__main__":
    import sys
    force = "--force" in sys.argv
    t = get_access_token(force_refresh=force)
    cached = _read_cache() or {}
    print(f"source: {cached.get('source','?')}  expires_in: {int((cached.get('expires_at',0) - time.time()))}s  len: {len(t)}")
