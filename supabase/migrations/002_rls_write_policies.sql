-- ============================================================
-- Migration: 002_rls_write_policies.sql
-- Adds INSERT/UPDATE/DELETE RLS policies for the server-side
-- service role (anon key fallback for local development).
--
-- HOW THIS WORKS:
--   Supabase has two privilege levels for its client libraries:
--
--   1. anon key   (NEXT_PUBLIC_SUPABASE_ANON_KEY)
--      - Subject to RLS policies defined below.
--      - Safe to expose in browser bundles.
--      - Used as fallback when SERVICE_ROLE_KEY is absent.
--
--   2. service_role key  (SUPABASE_SERVICE_ROLE_KEY — server-only)
--      - Bypasses RLS entirely. Never expose to the browser.
--      - Correct key for all Next.js Server Actions / Route Handlers.
--      - Once this key is set in .env.local, the policies below
--        are not exercised by server code (but kept for safety).
--
-- PRODUCTION NOTE:
--   Replace 'true' with auth.uid() checks once Supabase Auth is wired up.
--   Example: using auth_uid() IS NOT NULL to require a logged-in user.
-- ============================================================

-- ── brands ────────────────────────────────────────────────────────────────────

create policy "anon_insert_brands"
  on brands for insert
  with check (true);

create policy "anon_update_brands"
  on brands for update
  using (true)
  with check (true);

create policy "anon_delete_brands"
  on brands for delete
  using (true);

-- ── campaigns ─────────────────────────────────────────────────────────────────

create policy "anon_insert_campaigns"
  on campaigns for insert
  with check (true);

create policy "anon_update_campaigns"
  on campaigns for update
  using (true)
  with check (true);

create policy "anon_delete_campaigns"
  on campaigns for delete
  using (true);

-- ── creatives ─────────────────────────────────────────────────────────────────

create policy "anon_insert_creatives"
  on creatives for insert
  with check (true);

create policy "anon_update_creatives"
  on creatives for update
  using (true)
  with check (true);

create policy "anon_delete_creatives"
  on creatives for delete
  using (true);

-- ── storage.objects (creative-assets bucket) ──────────────────────────────────
-- The storage bucket INSERT policy from 001 already uses `with check (true)`.
-- No changes needed here unless you locked it down between migrations.
