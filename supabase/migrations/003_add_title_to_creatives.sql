-- ============================================================
-- Migration: 003_add_title_to_creatives.sql
-- Adds an optional `title` column to the creatives table.
-- When NULL the UI falls back to the derived display title.
-- ============================================================

alter table creatives
  add column if not exists title text;

comment on column creatives.title is
  'Optional human-readable title. When NULL the UI derives one from the source_url and platform.';
