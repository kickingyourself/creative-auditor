-- ============================================================
-- Seed: 001_seed_brands.sql
-- Inserts the four placeholder brands referenced by the
-- frontend (app/brands/page.tsx) with their exact hardcoded UUIDs.
--
-- Run this in Supabase Studio → SQL Editor AFTER running both
-- migrations (001_initial_schema.sql, 002_rls_write_policies.sql).
--
-- ON CONFLICT DO NOTHING makes this idempotent — safe to re-run.
-- ============================================================

insert into brands (id, name, website_url, logo_url, created_at)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Nike',
    'https://www.nike.com',
    null,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Oatly',
    'https://www.oatly.com',
    null,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Apple',
    'https://www.apple.com',
    null,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Notion',
    'https://www.notion.so',
    null,
    now()
  )
on conflict (id) do nothing;
