/**
 * app/api/brands/search/route.ts
 *
 * GET /api/brands/search?q=<query>
 *
 * Case-insensitive prefix search on brands.name.
 * Returns up to 8 matches: [{ id, name }]
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("missing config");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) return Response.json([]);

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("brands")
      .select("id, name")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .ilike("name", `%${q}%` as any)
      .order("name")
      .limit(8);

    if (error) return Response.json([], { status: 200 });
    return Response.json(data ?? []);
  } catch {
    return Response.json([], { status: 200 });
  }
}
