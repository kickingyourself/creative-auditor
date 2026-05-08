/**
 * utils/supabase/server.ts
 *
 * Supabase client for use in Server Components, Server Actions, and
 * Route Handlers. Uses the SERVICE_ROLE_KEY (bypasses RLS) when available,
 * otherwise falls back to the anon key.
 *
 * Never import this in Client Components — it exposes server-only env vars.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local."
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}
