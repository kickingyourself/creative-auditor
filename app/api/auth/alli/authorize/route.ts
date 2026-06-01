/**
 * app/api/auth/alli/authorize/route.ts
 *
 * GET /api/auth/alli/authorize?redirect_after=/settings
 *
 * Initiates the Alli OAuth 2.1 + PKCE authorization flow:
 *   1. Generate cryptographically random state (CSRF) and code_verifier (PKCE).
 *   2. Derive code_challenge = BASE64URL(SHA-256(code_verifier)).
 *   3. Persist state + code_verifier in alli_oauth_states (10-min TTL).
 *   4. Redirect the browser to the Alli authorization endpoint.
 *
 * The Alli OAuth server is at https://login.alliplatform.com.
 * The pre-registered client ID is returned by the Alli DCR shim.
 */

import { createClient } from "@supabase/supabase-js";
import { ALLI_MCP_BASE_URL, ALLI_LOGIN_BASE_URL, ALLI_OAUTH_CLIENT_ID } from "@/lib/alli-mcp";

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** base64url-encode a Uint8Array without padding. */
function base64url(buf: Uint8Array): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function GET(req: Request): Promise<Response> {
  const url          = new URL(req.url);
  const redirectAfter = url.searchParams.get("redirect_after") ?? "/settings";

  // ── 1. Generate PKCE code_verifier (64 random bytes → base64url) ─────────
  const verifierBytes  = new Uint8Array(64);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier   = base64url(verifierBytes);

  // ── 2. Derive code_challenge = SHA-256(code_verifier) → base64url ─────────
  const digest         = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  const codeChallenge  = base64url(new Uint8Array(digest));

  // ── 3. Generate random state for CSRF protection ───────────────────────────
  const stateBytes     = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state          = base64url(stateBytes);

  // ── 4. Persist state + verifier in DB ─────────────────────────────────────
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbErr } = await (db as any)
    .from("alli_oauth_states")
    .insert({ state, code_verifier: codeVerifier, redirect_after: redirectAfter });

  if (dbErr) {
    return Response.json({ error: "Failed to persist OAuth state." }, { status: 500 });
  }

  // ── 5. Try to discover the client_id via DCR shim (falls back to env/const) ─
  let clientId = ALLI_OAUTH_CLIENT_ID;
  try {
    const dcrRes = await fetch(`${ALLI_MCP_BASE_URL}/oauth/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        redirect_uris:           [getRedirectUri(req)],
        token_endpoint_auth_method: "none",
        grant_types:             ["authorization_code"],
        response_types:          ["code"],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (dcrRes.ok) {
      const dcrData = await dcrRes.json();
      if (dcrData.client_id) clientId = dcrData.client_id as string;
    }
  } catch {
    // DCR failed — use the known pre-registered client ID
  }

  // ── 6. Build authorization URL ─────────────────────────────────────────────
  const params = new URLSearchParams({
    response_type:          "code",
    client_id:              clientId,
    redirect_uri:           getRedirectUri(req),
    scope:                  "openid profile email offline_access",
    state,
    code_challenge:         codeChallenge,
    code_challenge_method:  "S256",
  });

  const authUrl = `${ALLI_LOGIN_BASE_URL}/authorize?${params}`;
  return Response.redirect(authUrl, 302);
}

/**
 * Derives the absolute callback URI from the incoming request's origin.
 *
 * CRITICAL (per Alli docs): The redirect URI must use 127.0.0.1, NOT localhost.
 * Alli Central's OAuth validator only applies port-flexible loopback matching
 * to 127.0.0.1 and [::1]. Using 'localhost' causes an invalid_client error.
 */
function getRedirectUri(req: Request): string {
  // If an explicit production URL is set, use it as-is.
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/alli/callback`;
  }

  // For local dev: replace 'localhost' with '127.0.0.1' — required by Alli.
  const origin = new URL(req.url).origin.replace(/\/\/localhost/, "//127.0.0.1");
  return `${origin}/api/auth/alli/callback`;
}
