/**
 * lib/alli-mcp.ts
 *
 * Alli MCP client for server-side tool calls.
 *
 * Responsibilities:
 *   1. Read the stored Alli OAuth token from Supabase.
 *   2. Auto-refresh the access token if it's within 5 minutes of expiry.
 *   3. Make MCP JSON-RPC tool calls to mcp.alliplatform.com.
 *   4. Discover available tools for a given prefix.
 *
 * Usage:
 *   const client = await getAlliMcpClient();
 *   const result = await client.call("digital_asset_manager", "list_assets", { limit: 50 });
 *
 * Environment variables required:
 *   ALLI_MCP_BASE_URL       (default: https://mcp.alliplatform.com)
 *   ALLI_LOGIN_BASE_URL     (default: https://login.alliplatform.com)
 *   ALLI_OAUTH_CLIENT_ID    (default: production DCR client ID)
 */

import { createClient } from "@supabase/supabase-js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const ALLI_MCP_BASE_URL   = process.env.ALLI_MCP_BASE_URL   ?? "https://mcp.alliplatform.com";
export const ALLI_LOGIN_BASE_URL = process.env.ALLI_LOGIN_BASE_URL ?? "https://login.alliplatform.com";

// Pre-registered native OAuth client ID (from the Alli DCR shim).
// Production: 77e7f3ff-f1f4-416b-b66b-62ac76746eb1
// Staging:    988344d4-9906-4f1e-a801-f22947f7ea0e
export const ALLI_OAUTH_CLIENT_ID =
  process.env.ALLI_OAUTH_CLIENT_ID ?? "77e7f3ff-f1f4-416b-b66b-62ac76746eb1";

// Token is refreshed when it has fewer than this many seconds remaining.
const REFRESH_BUFFER_SECONDS = 300; // 5 minutes

// ── Supabase client ───────────────────────────────────────────────────────────

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ── Token types ───────────────────────────────────────────────────────────────

export interface AlliTokenRow {
  id: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string;
  scope: string | null;
}

export interface AlliTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
}

// ── Error class ───────────────────────────────────────────────────────────────

export class AlliAuthError extends Error {
  constructor(message: string, public readonly code: "NOT_CONNECTED" | "REFRESH_FAILED" | "CALL_FAILED") {
    super(message);
    this.name = "AlliAuthError";
  }
}

// ── Token storage ─────────────────────────────────────────────────────────────

/** Reads the stored token row. Returns null if no connection exists. */
export async function getStoredToken(): Promise<AlliTokenRow | null> {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("alli_oauth_tokens")
    .select("id, access_token, refresh_token, token_type, expires_at, scope")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

/** Persists a new token (upsert — only one row is ever kept). */
export async function saveToken(
  tokenResponse: AlliTokenResponse,
  existingId?: string,
): Promise<AlliTokenRow> {
  const db = getDb();
  const expiresAt = new Date(
    Date.now() + ((tokenResponse.expires_in ?? 3600) - 10) * 1000,
  ).toISOString();

  const row = {
    access_token:  tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token ?? null,
    token_type:    tokenResponse.token_type ?? "Bearer",
    expires_at:    expiresAt,
    scope:         tokenResponse.scope ?? null,
    id_token:      tokenResponse.id_token ?? null,
    raw_response:  tokenResponse,
  };

  let result;
  if (existingId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ data: result } = await (db as any)
      .from("alli_oauth_tokens")
      .update(row)
      .eq("id", existingId)
      .select("id, access_token, refresh_token, token_type, expires_at, scope")
      .single());
  } else {
    // Delete old rows first (keep only one)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("alli_oauth_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ data: result } = await (db as any)
      .from("alli_oauth_tokens")
      .insert(row)
      .select("id, access_token, refresh_token, token_type, expires_at, scope")
      .single());
  }

  return result as AlliTokenRow;
}

/** Deletes all stored tokens (disconnect). */
export async function deleteStoredToken(): Promise<void> {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).from("alli_oauth_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

// ── Token refresh ─────────────────────────────────────────────────────────────

/** Exchanges a refresh_token for a new access_token. Updates the DB row. */
async function refreshToken(row: AlliTokenRow): Promise<AlliTokenRow> {
  if (!row.refresh_token) {
    throw new AlliAuthError("No refresh_token stored — user must re-authenticate.", "NOT_CONNECTED");
  }

  const res = await fetch(`${ALLI_LOGIN_BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: row.refresh_token,
      client_id:     ALLI_OAUTH_CLIENT_ID,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AlliAuthError(`Token refresh failed (${res.status}): ${text}`, "REFRESH_FAILED");
  }

  const tokenResponse: AlliTokenResponse = await res.json();
  return saveToken(tokenResponse, row.id);
}

// ── Active token (auto-refresh) ───────────────────────────────────────────────

/**
 * Returns a valid access token, refreshing it automatically if it's near expiry.
 * Throws AlliAuthError if not connected.
 */
export async function getValidAccessToken(): Promise<string> {
  const row = await getStoredToken();
  if (!row) throw new AlliAuthError("Not connected to Alli — complete OAuth flow first.", "NOT_CONNECTED");

  const expiresAt  = new Date(row.expires_at).getTime();
  const nowMs      = Date.now();
  const secondsLeft = (expiresAt - nowMs) / 1000;

  if (secondsLeft < REFRESH_BUFFER_SECONDS) {
    const refreshed = await refreshToken(row);
    return refreshed.access_token;
  }

  return row.access_token;
}

// ── MCP tool call ─────────────────────────────────────────────────────────────

export interface McpCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Calls a single MCP tool on the given prefix.
 *
 * @param prefix  - One of the 18 Alli MCP prefixes (e.g. "digital_asset_manager")
 * @param tool    - Exact tool name (get from tools/list)
 * @param params  - Flat parameter object (path + query + body merged)
 */
export async function alliMcpCall(
  prefix: string,
  tool: string,
  params: Record<string, unknown> = {},
): Promise<McpCallResult> {
  const token = await getValidAccessToken();

  const body = {
    jsonrpc: "2.0",
    id:      1,
    method:  "tools/call",
    params:  { name: tool, arguments: params },
  };

  const res = await fetch(`${ALLI_MCP_BASE_URL}/mcp/${prefix}`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AlliAuthError(
      `MCP call failed (${res.status}): ${text}`,
      "CALL_FAILED",
    );
  }

  const json = await res.json();

  // MCP JSON-RPC response shape: { jsonrpc, id, result: { content, isError } }
  if (json.error) {
    throw new AlliAuthError(
      `MCP error: ${json.error.message ?? JSON.stringify(json.error)}`,
      "CALL_FAILED",
    );
  }

  return json.result as McpCallResult;
}

/**
 * Returns the list of tools available for a given prefix.
 * Useful for discovery and debugging.
 */
export async function alliMcpListTools(prefix: string): Promise<{
  tools: Array<{ name: string; description: string; inputSchema: unknown }>;
}> {
  const token = await getValidAccessToken();

  const res = await fetch(`${ALLI_MCP_BASE_URL}/mcp/${prefix}`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });

  if (!res.ok) throw new AlliAuthError(`tools/list failed (${res.status})`, "CALL_FAILED");
  const json = await res.json();
  return json.result;
}

/** Parses the text content out of an MCP call result. */
export function mcpResultText(result: McpCallResult): string {
  return result.content.map(c => c.text).join("\n");
}

/** Parses JSON from the first text content block. */
export function mcpResultJson<T = unknown>(result: McpCallResult): T {
  const text = result.content.find(c => c.type === "text")?.text ?? "{}";
  return JSON.parse(text) as T;
}
