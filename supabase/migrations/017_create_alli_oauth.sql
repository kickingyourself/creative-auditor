-- 017_create_alli_oauth.sql
--
-- Phase 6 (Part 1): Alli OAuth 2.1 + PKCE token storage.
--
-- alli_oauth_tokens  — stores the current access + refresh token.
--   Only one row ever exists (org-wide connection).
--   Access tokens expire in ~1 hour; refresh tokens are long-lived.
--
-- alli_oauth_states  — short-lived CSRF state + PKCE verifier.
--   Cleaned up on callback or after 10 minutes.

CREATE TABLE IF NOT EXISTS alli_oauth_tokens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token  TEXT        NOT NULL,
  refresh_token TEXT,                        -- nullable; not all flows return one
  token_type    TEXT        NOT NULL DEFAULT 'Bearer',
  expires_at    TIMESTAMPTZ NOT NULL,
  scope         TEXT,
  id_token      TEXT,                        -- OIDC id_token if returned
  raw_response  JSONB,                       -- full token response for debugging
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE alli_oauth_tokens IS
  'Gold: Alli OAuth 2.1 tokens (org-wide). Always upsert the single row; '
  'use refresh_token to renew access_token before it expires.';

-- Trigger: keep updated_at current
DROP TRIGGER IF EXISTS trg_alli_tokens_updated_at ON alli_oauth_tokens;
CREATE TRIGGER trg_alli_tokens_updated_at
  BEFORE UPDATE ON alli_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ── CSRF / PKCE state table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alli_oauth_states (
  state          TEXT        PRIMARY KEY,    -- random opaque value sent to Alli
  code_verifier  TEXT        NOT NULL,       -- PKCE S256 verifier (kept server-side)
  redirect_after TEXT,                       -- optional: where to send user after auth
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_alli_oauth_states_expires
  ON alli_oauth_states (expires_at);

COMMENT ON TABLE alli_oauth_states IS
  'Short-lived OAuth CSRF state + PKCE code_verifier. Expired rows are safe to delete.';
