-- 014_create_competitor_sets.sql
--
-- Phase 4: Competitor benchmarking dimension tables.
--
-- A "competitor set" is a named group of brands that should be benchmarked
-- against each other. One brand can belong to multiple sets.
-- A single brand in the set is marked is_focal = true (the one being evaluated).
--
-- Usage:
--   1. Create a set: INSERT INTO dim_competitor_sets (name) VALUES ('PayPal 2026');
--   2. Add brands:   INSERT INTO dim_competitor_set_members (set_id, brand_id, is_focal)
--                    VALUES (..., true), (..., false), ...;
--   3. Query:        SELECT * FROM rpt_channel_coverage WHERE set_id = '...';

CREATE TABLE IF NOT EXISTS dim_competitor_sets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dim_competitor_sets IS
  'Gold: a named grouping of brands for competitive benchmarking.';

CREATE TABLE IF NOT EXISTS dim_competitor_set_members (
  set_id    UUID NOT NULL REFERENCES dim_competitor_sets(id) ON DELETE CASCADE,
  brand_id  UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  -- true = the focal brand whose gap we are measuring.
  -- Each set should have exactly one focal brand.
  is_focal  BOOLEAN NOT NULL DEFAULT false,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_set_members_brand
  ON dim_competitor_set_members (brand_id);
CREATE INDEX IF NOT EXISTS idx_set_members_focal
  ON dim_competitor_set_members (set_id) WHERE is_focal = true;

COMMENT ON TABLE dim_competitor_set_members IS
  'Gold: brand membership in a competitor set. is_focal marks the brand being evaluated.';
COMMENT ON COLUMN dim_competitor_set_members.is_focal IS
  'true = this is the focal brand. Each set should have exactly one focal member.';

-- Auto-update updated_at on dim_competitor_sets changes
-- (fn_set_updated_at was created in migration 013)
DROP TRIGGER IF EXISTS trg_competitor_sets_updated_at ON dim_competitor_sets;
CREATE TRIGGER trg_competitor_sets_updated_at
  BEFORE UPDATE ON dim_competitor_sets
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
