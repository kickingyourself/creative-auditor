-- 009_add_sort_order_to_creatives.sql
--
-- Adds a sort_order column to creatives so users can drag-and-drop
-- tiles within a campaign channel and have the order persist globally.
--
-- Strategy:
--   • INTEGER, nullable. NULL = unranked (falls back to created_at DESC).
--   • Seeded to a dense rank per (campaign_id, platform) based on
--     current created_at DESC so existing order is preserved on deploy.
--   • Index on (campaign_id, platform, sort_order) for fast ordered fetches.

ALTER TABLE creatives ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Seed existing rows with their current creation-time rank so the
-- first deploy doesn't scramble anything.
UPDATE creatives c
SET    sort_order = sub.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY campaign_id, platform
           ORDER BY created_at ASC
         ) AS rn
  FROM   creatives
  WHERE  campaign_id IS NOT NULL
) sub
WHERE c.id = sub.id;

-- Fast ordered fetches per campaign channel
CREATE INDEX IF NOT EXISTS idx_creatives_campaign_platform_sort
  ON creatives (campaign_id, platform, sort_order ASC NULLS LAST);
