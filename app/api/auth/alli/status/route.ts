/**
 * app/api/auth/alli/status/route.ts
 *
 * GET /api/auth/alli/status
 *
 * Returns the current Alli connection status:
 *   connected:      true/false
 *   expires_at:     ISO string (if connected)
 *   needs_refresh:  true if token expires within 5 min
 *   scope:          granted OAuth scopes
 */

import { getStoredToken } from "@/lib/alli-mcp";

export async function GET(): Promise<Response> {
  const token = await getStoredToken();

  if (!token) {
    return Response.json({ connected: false });
  }

  const expiresAt    = new Date(token.expires_at);
  const secondsLeft  = (expiresAt.getTime() - Date.now()) / 1000;
  const needsRefresh = secondsLeft < 300;
  const expired      = secondsLeft <= 0;

  return Response.json({
    connected:     !expired,
    expires_at:    token.expires_at,
    needs_refresh: needsRefresh,
    scope:         token.scope,
    has_refresh_token: !!token.refresh_token,
  });
}
