---
name: alli-mcp-auth
description: Automatically authenticate or re-authenticate Alli. Checks for a valid ALLI_REFRESH_TOKEN in .env and runs the browser OAuth flow via pmg-cowork-login when missing or revoked. Use any time an Alli MCP / Central API call is about to run, returns 401 / invalid_grant, or when the user says "reauth alli", "refresh alli", "fix alli auth".
---

# Alli MCP Auth

One-purpose skill: ensure a valid Alli refresh token is present in `.env` with zero user friction. Wraps the working `pmg-cowork-login alli` flow so callers never have to think about token state.

## When to Use

Invoke **before any Alli MCP or Alli Central API call** if the auth state is unknown, or proactively whenever:

- A call returns `401 Unauthorized` or an SSE payload with `"status": 401`
- A token refresh returns `invalid_grant` / `Token has been revoked`
- `.env` is missing `ALLI_CLIENT_ID` or `ALLI_REFRESH_TOKEN`
- A skill errors with `ALLI_CLIENT_ID or ALLI_REFRESH_TOKEN not found in .env` (e.g. `alli-list-clients`)
- User says "reauth alli", "refresh alli mcp", "fix alli auth", or similar

**Do not ask the user to manually paste a token.** Run the flow automatically.

## Config Location (Hard Rule)

- `.env` at the workspace root: `/Users/maxwellthomason/PMG - Workspace/.env`
- Required keys (user flow): `ALLI_CLIENT_ID`, `ALLI_REFRESH_TOKEN`
- Optional keys (machine flow, preferred when present): `ALLI_MACHINE_CLIENT_ID`, `ALLI_MACHINE_CLIENT_SECRET` (`client_credentials` grant — no rotation, no browser, `.env`-storable)
- Never `source .env` — read with `grep` (see global CLAUDE.md rule about not reading `.env`; check presence only, never echo values)
- The auth script writes both keys via `python-dotenv`'s `set_key` — do not edit manually

## Token cache (rotation-safe)

`scripts/alli_token_cache.py` provides `get_access_token(force_refresh=False)` that:
- Caches access tokens at `~/.cache/alli-token/access_token.json` with a 50-min TTL.
- Serializes refresh-token rotation via `flock` so concurrent callers don't race the grant.
- Prefers `client_credentials` (`ALLI_MACHINE_CLIENT_ID` + `ALLI_MACHINE_CLIENT_SECRET`) when set; falls back to user `refresh_token` grant.
- Persists rotated refresh tokens back to `.env` immediately on the user-grant path.

**Why:** long-running scripts that call `get_access_token()` multiple times were hitting `400 Bad Request` mid-run because the `.env` refresh token had already been rotated by an earlier call in the same script. The cache eliminates the rotation race for the common cache-hit path; the lock serializes the cache-miss path.

**Use it from any caller:**
```python
import sys, pathlib
sys.path.insert(0, str(pathlib.Path("/Users/maxwellthomason/PMG - Workspace/.agents/skills/alli-mcp-auth/scripts")))
from alli_token_cache import get_access_token, invalidate
t = get_access_token()
# on 401: invalidate(); t = get_access_token(force_refresh=True)
```

This supersedes the inline `get_access_token()` in `_alli_helpers.py`, `list_clients.py`, `run_query.py`, etc. — they should delegate to this cache.

## Auth Decision Tree

```
1. Check .env for ALLI_REFRESH_TOKEN
   -> present  : assume valid; let the call proceed
   -> missing  : fall through to step 2

2. Run pmg-cowork-login alli (browser OAuth)
   -> dynamically registers ALLI_CLIENT_ID if absent
   -> opens browser; user logs in once
   -> writes ALLI_CLIENT_ID + ALLI_REFRESH_TOKEN to .env

3. On 401 / invalid_grant from a live call
   -> treat as revoked; rerun step 2 to refresh
```

This skill is also wired as a `SessionStart` hook in `.claude/settings.json`, so step 1 runs automatically at session start. Invoke this skill explicitly when reacting to a mid-session 401.

## Step 1 — Presence Check

```bash
grep -qE '^ALLI_REFRESH_TOKEN=.+' .env 2>/dev/null && echo "alli auth ready" || echo "alli auth missing — running login"
```

## Step 2 — Run the OAuth Flow

```bash
python3 .agents/skills/pmg-cowork-login/authorizations/alli/auth.py
```

What the script does:

1. Spins up a local HTTP listener on `127.0.0.1` with an ephemeral port
2. If `ALLI_CLIENT_ID` is missing, performs Dynamic Client Registration (DCR) with the actual runtime `redirect_uri` and writes the new `ALLI_CLIENT_ID` to `.env`
3. Opens the browser to the Alli authorize endpoint
4. Catches the callback, exchanges `authorization_code` for tokens
5. Writes `ALLI_REFRESH_TOKEN` to `.env` via `python-dotenv` `set_key`

The only user interaction required is clicking "Approve" in the browser once.

## Step 3 — Verify

After re-auth, confirm with `alli-list-clients`:

```bash
python3 .agents/skills/alli-list-clients/scripts/list_clients.py
```

Expected: a list of clients you have access to, with their slugs and UUIDs.

## Pitfalls (lessons learned)

| Pitfall | Fix |
|---|---|
| A stale `ALLI_CLIENT_ID` was registered with a different `redirect_uri` than the one the listener is bound to — callback returns no `code` | Delete `ALLI_CLIENT_ID` from `.env` and rerun; the script will DCR a fresh client matching the runtime URI |
| `state mismatch` on callback | The script preserves `state` between authorize and callback — do not patch around it |
| Refresh token revoked after a long gap | Rerun the OAuth flow; refresh tokens rotate per use, so a forgotten session can leave the saved one stale |
| User asked twice for credentials | Forbidden — see Do-Not-Ask Rule below |

## Integration with Other Alli Skills

Pair this skill with any of:

- `alli-list-clients` — needs `ALLI_REFRESH_TOKEN`
- `alli-gendash-list`, `alli-unified-data-*` — same auth surface
- Any `mcp__alli_actions__*` MCP tool call

Run `alli-mcp-auth` first whenever auth state is uncertain, then proceed with the actual call.

## Do-Not-Ask Rule

Never ask the user whether to re-auth, never ask for a token, never ask for credentials. Just run the flow. The only user interaction required is clicking "Approve" in the browser once when a full re-auth is needed — that's it.
