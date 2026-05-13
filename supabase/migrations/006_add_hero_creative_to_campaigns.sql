-- ============================================================
-- Migration: 006_add_hero_creative_to_campaigns.sql
--
-- Adds hero_creative_id to the campaigns table so that the
-- hero banner selection persists across sessions in the DB.
--
-- The column is a nullable FK to creatives (id).
-- ON DELETE SET NULL: if the hero creative is deleted, the
-- campaign falls back to the automatic hero logic rather than
-- breaking the FK.
-- ============================================================

alter table campaigns
  add column if not exists hero_creative_id uuid
    references creatives (id)
    on delete set null;

comment on column campaigns.hero_creative_id is
  'UUID of the pinned hero creative for this campaign. NULL = auto-select (most recent landing_page or youtube creative).';

-- Index so the FK lookup is fast when joining/filtering by hero
create index if not exists idx_campaigns_hero_creative_id
  on campaigns (hero_creative_id)
  where hero_creative_id is not null;
