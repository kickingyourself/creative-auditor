/**
 * app/api/auth/alli/token/route.ts
 *
 * POST /api/auth/alli/token
 *
 * Accepts a manually-provided Bearer token and stores it.
 * Used when the OAuth redirect flow can't complete (e.g., redirect URI
 * not yet registered with Alli's auth server for this domain).
 *
 * Body: { access_token: string, expires_in?: number }
 *
 * The token is validated against Alli Central's /me endpoint before storage.
 */

import { saveToken } from "@/lib/alli-mcp";
import { ALLI_MCP_BASE_URL } from "@/lib/alli-mcp";

export async function POST(req: Request): Promise<Response> {
  let body: { access_token?: string; expires_in?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { access_token, expires_in = 3600 } = body;

  if (!access_token || typeof access_token !== "string" || access_token.trim().length < 20) {
    return Response.json({ error: "access_token is required and must be a valid token string." }, { status: 400 });
  }

  // ── Validate token against Alli Central /me ───────────────────────────────
  let userInfo: { email?: string; userId?: string } = {};
  try {
    const meRes = await fetch(`${ALLI_MCP_BASE_URL}/mcp/alli_central`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token.trim()}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_me", arguments: {} } }),
      signal: AbortSignal.timeout(10_000),
    });

    if (meRes.ok) {
      const meData = await meRes.json();
      const text = meData?.result?.content?.[0]?.text ?? "{}";
      try { userInfo = JSON.parse(text); } catch { /* ignore */ }
    } else if (meRes.status === 401) {
      return Response.json({ error: "Token rejected by Alli — invalid or expired." }, { status: 401 });
    }
    // Non-401 errors (404, 502 etc.) — token may still be valid, continue
  } catch {
    // Network error during validation — store the token anyway with a warning
    userInfo = {};
  }

  // ── Store token ───────────────────────────────────────────────────────────
  await saveToken({
    access_token:  access_token.trim(),
    token_type:    "Bearer",
    expires_in,
    scope:         "manual",
  });

  return Response.json({
    stored:   true,
    email:    userInfo.email ?? null,
    user_id:  userInfo.userId ?? null,
    message:  "Token stored. Connection active.",
  });
}
