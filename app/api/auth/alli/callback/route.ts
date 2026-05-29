/**
 * app/api/auth/alli/callback/route.ts
 *
 * GET /api/auth/alli/callback?code=...&state=...
 *
 * OAuth 2.1 + PKCE callback handler:
 *   1. Validate state against alli_oauth_states (CSRF check).
 *   2. Exchange authorization code for tokens using stored code_verifier.
 *   3. Persist access_token + refresh_token to alli_oauth_tokens.
 *   4. Clean up the state row.
 *   5. Redirect to redirect_after (default: /settings).
 */

import { createClient } from "@supabase/supabase-js";
import { ALLI_LOGIN_BASE_URL, ALLI_OAUTH_CLIENT_ID, saveToken } from "@/lib/alli-mcp";
import type { AlliTokenResponse } from "@/lib/alli-mcp";

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function getRedirectUri(req: Request): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL
    ?? new URL(req.url).origin;
  return `${origin}/api/auth/alli/callback`;
}

export async function GET(req: Request): Promise<Response> {
  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // ── User denied authorization ──────────────────────────────────────────────
  if (error) {
    const desc = url.searchParams.get("error_description") ?? error;
    return errorRedirect(req, `Alli authorization denied: ${desc}`);
  }

  if (!code || !state) {
    return errorRedirect(req, "Missing code or state in callback.");
  }

  // ── 1. Validate state (CSRF + PKCE verifier lookup) ───────────────────────
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stateRow, error: stateErr } = await (db as any)
    .from("alli_oauth_states")
    .select("state, code_verifier, redirect_after, expires_at")
    .eq("state", state)
    .single();

  if (stateErr || !stateRow) {
    return errorRedirect(req, "Invalid or expired OAuth state. Please try again.");
  }

  if (new Date(stateRow.expires_at) < new Date()) {
    return errorRedirect(req, "OAuth state expired. Please try again.");
  }

  const codeVerifier  = stateRow.code_verifier as string;
  const redirectAfter = (stateRow.redirect_after as string) ?? "/settings";

  // ── 2. Exchange code for tokens ────────────────────────────────────────────
  const tokenRes = await fetch(`${ALLI_LOGIN_BASE_URL}/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:     "authorization_code",
      code,
      redirect_uri:   getRedirectUri(req),
      client_id:      ALLI_OAUTH_CLIENT_ID,
      code_verifier:  codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("[alli/callback] Token exchange failed:", text);
    return errorRedirect(req, `Token exchange failed (${tokenRes.status}). Check server logs.`);
  }

  const tokenData: AlliTokenResponse = await tokenRes.json();

  // ── 3. Persist tokens ──────────────────────────────────────────────────────
  try {
    await saveToken(tokenData);
  } catch (err) {
    console.error("[alli/callback] Failed to save token:", err);
    return errorRedirect(req, "Connected but failed to save token. Please try again.");
  }

  // ── 4. Clean up state row ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).from("alli_oauth_states").delete().eq("state", state);

  // ── 5. Also clean up expired state rows (opportunistic GC) ────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .from("alli_oauth_states")
    .delete()
    .lt("expires_at", new Date().toISOString());

  // ── 6. Redirect to success page ────────────────────────────────────────────
  const origin  = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const dest    = new URL(redirectAfter, origin);
  dest.searchParams.set("alli_connected", "1");
  return Response.redirect(dest.toString(), 302);
}

/** Redirects to /settings with an error message in the query string. */
function errorRedirect(req: Request, message: string): Response {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const dest   = new URL("/settings", origin);
  dest.searchParams.set("alli_error", message);
  return Response.redirect(dest.toString(), 302);
}
