-- ============================================================
-- Migration: 005_rename_homepage_to_landing_page.sql
--
-- Renames the 'homepage' value in the platform_type enum to
-- 'landing_page'. Postgres stores enum values by internal OID,
-- so existing rows are updated automatically — no UPDATE needed.
--
-- Requires Postgres 10+.
-- ============================================================

ALTER TYPE platform_type RENAME VALUE 'homepage' TO 'landing_page';
