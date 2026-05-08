/**
 * lib/errors.ts
 *
 * Typed API error helpers used by all ingest route handlers.
 */

export interface ApiErrorBody {
  error: string;
  code: string;
  detail?: string;
}

/** Maps a well-known error code to an HTTP status and message. */
const ERROR_MAP: Record<string, { status: number; message: string }> = {
  MISSING_BODY_FIELD: { status: 400, message: "Required field missing in request body." },
  INVALID_URL: { status: 422, message: "The provided URL is not valid for this platform." },
  MISSING_API_KEY: { status: 500, message: "Server is missing a required API key." },
  VIDEO_NOT_FOUND: { status: 404, message: "No video was found at the provided URL." },
  UPSTREAM_RATE_LIMIT: { status: 429, message: "Upstream API rate limit reached. Retry later." },
  UPSTREAM_ERROR: { status: 502, message: "Upstream API returned an unexpected error." },
  SUPABASE_INSERT_ERROR: { status: 500, message: "Failed to persist creative to the database." },
  DUPLICATE_CREATIVE: { status: 409, message: "A creative with this URL already exists for the brand." },
  INTERNAL: { status: 500, message: "An unexpected internal error occurred." },
};

/**
 * Returns a JSON Response with a structured error body.
 * @param code - A key from ERROR_MAP
 * @param detail - Optional extra context (omit in production if sensitive)
 */
export function apiError(code: string, detail?: string): Response {
  const entry = ERROR_MAP[code] ?? ERROR_MAP["INTERNAL"];
  const body: ApiErrorBody = { error: entry.message, code, detail };
  return Response.json(body, { status: entry.status });
}

/**
 * Detects Supabase error codes and maps them to our error system.
 * - 23505 = unique_violation (duplicate source_url + brand_id)
 */
export function supabaseErrorCode(pgCode: string | undefined): string {
  if (pgCode === "23505") return "DUPLICATE_CREATIVE";
  return "SUPABASE_INSERT_ERROR";
}
