/**
 * app/api/auth/alli/disconnect/route.ts
 *
 * DELETE /api/auth/alli/disconnect
 *
 * Removes the stored Alli OAuth tokens and OAuth state rows.
 * Does NOT attempt to revoke the token upstream (Alli doesn't expose
 * a standard /revoke endpoint publicly).
 */

import { deleteStoredToken } from "@/lib/alli-mcp";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(): Promise<Response> {
  // Remove tokens
  await deleteStoredToken();

  // Also purge any lingering state rows
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .from("alli_oauth_states")
    .delete()
    .neq("state", "");

  return Response.json({ disconnected: true });
}
